<?php
/**
 * WebserviceSpecificManagement for REGEN Order Sources
 *
 * Handles GET /api/regen_order_sources?output_format=JSON
 * Returns orders with their landing page URLs (from ps_connections_source)
 * for UTM attribution.
 *
 * Query parameters:
 *   filter[date_from] = YYYY-MM-DD (default: 30 days ago)
 *   filter[date_to]   = YYYY-MM-DD (default: today)
 *   filter[id_order]  = specific order ID
 *   limit             = max results (default: 1000)
 */

class WebserviceSpecificManagementRegenOrderSources implements WebserviceSpecificManagementInterface
{
    /** @var WebserviceOutputBuilder */
    protected $objOutput;

    /** @var WebserviceRequest */
    protected $wsObject;

    public function setObjectOutput(WebserviceOutputBuilderCore $obj)
    {
        $this->objOutput = $obj;
        return $this;
    }

    public function setWsObject(WebserviceRequestCore $obj)
    {
        $this->wsObject = $obj;
        return $this;
    }

    public function getWsObject()
    {
        return $this->wsObject;
    }

    public function getObjectOutput()
    {
        return $this->objOutput;
    }

    /**
     * Main handler - route to appropriate method
     */
    public function manage()
    {
        // Only GET is supported
        if ($this->wsObject->method !== 'GET') {
            throw new WebserviceException('Method not allowed. Use GET.', array(405, 405));
        }

        return $this->getOrderSources();
    }

    /**
     * Fetch orders with their landing page / UTM source data
     */
    protected function getOrderSources()
    {
        $db = Db::getInstance(_PS_USE_SQL_SLAVE_);

        // Parse filters
        $dateFrom = Tools::getValue('filter_date_from', date('Y-m-d', strtotime('-30 days')));
        $dateTo = Tools::getValue('filter_date_to', date('Y-m-d'));
        $orderId = (int) Tools::getValue('filter_id_order', 0);
        $limit = (int) Tools::getValue('limit', 1000);
        $shopId = (int) Context::getContext()->shop->id;

        // Validate dates
        if (!Validate::isDate($dateFrom)) {
            $dateFrom = date('Y-m-d', strtotime('-30 days'));
        }
        if (!Validate::isDate($dateTo)) {
            $dateTo = date('Y-m-d');
        }
        if ($limit < 1 || $limit > 5000) {
            $limit = 1000;
        }

        // Build query
        // Join chain: orders -> cart -> guest -> connections -> connections_source
        // We use "last click" attribution: the last connection source before the order date
        $sql = '
            SELECT
                o.id_order,
                o.reference,
                o.date_add AS order_date,
                o.total_paid_tax_incl AS total_ttc,
                o.id_currency,
                o.current_state,
                cu.iso_code AS currency_code,
                cs.request_uri,
                cs.http_referer,
                cs.date_add AS source_date
            FROM `' . _DB_PREFIX_ . 'orders` o
            INNER JOIN `' . _DB_PREFIX_ . 'cart` ca ON ca.id_cart = o.id_cart
            INNER JOIN `' . _DB_PREFIX_ . 'guest` g ON g.id_guest = ca.id_guest
            LEFT JOIN (
                -- Get the last connection for this guest BEFORE the order
                SELECT
                    c2.id_guest,
                    c2.id_connections,
                    c2.date_add AS connection_date
                FROM `' . _DB_PREFIX_ . 'connections` c2
                INNER JOIN (
                    SELECT id_guest, MAX(id_connections) AS max_conn
                    FROM `' . _DB_PREFIX_ . 'connections`
                    WHERE id_shop = ' . $shopId . '
                    GROUP BY id_guest
                ) c_max ON c2.id_connections = c_max.max_conn
            ) conn ON conn.id_guest = g.id_guest
            LEFT JOIN `' . _DB_PREFIX_ . 'connections_source` cs
                ON cs.id_connections = conn.id_connections
            LEFT JOIN `' . _DB_PREFIX_ . 'currency` cu ON cu.id_currency = o.id_currency
            WHERE o.id_shop = ' . $shopId . '
                AND o.date_add >= \'' . pSQL($dateFrom) . ' 00:00:00\'
                AND o.date_add <= \'' . pSQL($dateTo) . ' 23:59:59\'
        ';

        if ($orderId > 0) {
            $sql .= ' AND o.id_order = ' . $orderId;
        }

        // Only completed/valid orders (exclude cancelled)
        $sql .= ' AND o.current_state NOT IN (6, 7, 8)'; // 6=cancelled, 7=refunded, 8=payment error

        $sql .= ' ORDER BY o.date_add DESC';
        $sql .= ' LIMIT ' . $limit;

        $results = $db->executeS($sql);

        if (!$results) {
            $results = array();
        }

        // Parse UTM parameters from request_uri
        foreach ($results as &$row) {
            $utmData = $this->parseUtmFromUri($row['request_uri']);
            $row['utm_source'] = $utmData['utm_source'];
            $row['utm_medium'] = $utmData['utm_medium'];
            $row['utm_campaign'] = $utmData['utm_campaign'];
            $row['utm_content'] = $utmData['utm_content'];
            $row['utm_id'] = $utmData['utm_id'];
            $row['gclid'] = $utmData['gclid'];
            $row['gad_campaignid'] = $utmData['gad_campaignid'];
            $row['fbclid'] = $utmData['fbclid'];
            $row['ttclid'] = $utmData['ttclid'];
            $row['channel'] = $this->detectChannel($utmData);
        }

        // Build output
        $output = array(
            'regen_order_sources' => $results,
            'meta' => array(
                'count' => count($results),
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'shop_id' => $shopId,
                'generated_at' => date('Y-m-d H:i:s'),
            ),
        );

        // Return JSON
        $this->objOutput->setHeaderParams('Content-Type', 'application/json');
        return json_encode($output);
    }

    /**
     * Parse UTM parameters from a request URI
     */
    protected function parseUtmFromUri($uri)
    {
        $params = array(
            'utm_source' => null,
            'utm_medium' => null,
            'utm_campaign' => null,
            'utm_content' => null,
            'utm_id' => null,
            'gclid' => null,
            'gad_campaignid' => null,
            'fbclid' => null,
            'ttclid' => null,
        );

        if (empty($uri)) {
            return $params;
        }

        // Extract query string
        $queryString = '';
        if (strpos($uri, '?') !== false) {
            $queryString = substr($uri, strpos($uri, '?') + 1);
        } else {
            // Sometimes the URI IS the query string
            $queryString = $uri;
        }

        parse_str($queryString, $parsed);

        foreach ($params as $key => $value) {
            if (isset($parsed[$key]) && !empty($parsed[$key])) {
                $params[$key] = $parsed[$key];
            }
        }

        return $params;
    }

    /**
     * Detect the channel from UTM parameters
     */
    protected function detectChannel($utmData)
    {
        // Google Ads
        if (!empty($utmData['gclid'])
            || ($utmData['utm_source'] === 'google' && $utmData['utm_medium'] === 'cpc')
        ) {
            return 'google_ads';
        }

        // Meta Ads (Facebook / Instagram)
        if (!empty($utmData['fbclid'])
            || in_array($utmData['utm_source'], array('facebook', 'meta', 'instagram', 'fb', 'ig'))
        ) {
            return 'meta_ads';
        }

        // TikTok Ads
        if (!empty($utmData['ttclid'])
            || $utmData['utm_source'] === 'tiktok'
        ) {
            return 'tiktok_ads';
        }

        // Email
        if ($utmData['utm_medium'] === 'email') {
            return 'email';
        }

        // Referral (has UTM but not ads)
        if (!empty($utmData['utm_source'])) {
            return 'referral';
        }

        // Direct
        return 'direct';
    }

    /**
     * Required by the interface - returns content for specific management
     */
    public function getContent()
    {
        return '';
    }
}
