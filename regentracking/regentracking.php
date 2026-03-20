<?php
/**
 * REGEN Tracking - Order UTM Sources
 *
 * Expose les landing pages et parametres UTM des commandes
 * via l'API Webservice PrestaShop.
 *
 * Endpoint: GET /api/regen_order_sources?output_format=JSON
 * Filtres: filter[date_from]=YYYY-MM-DD&filter[date_to]=YYYY-MM-DD
 *
 * @author REGEN AGENCY
 * @version 1.0.0
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class RegenTracking extends Module
{
    public function __construct()
    {
        $this->name = 'regentracking';
        $this->tab = 'analytics_stats';
        $this->version = '1.0.0';
        $this->author = 'REGEN AGENCY';
        $this->need_instance = 0;
        $this->bootstrap = true;

        parent::__construct();

        $this->displayName = $this->l('REGEN Tracking - Order UTM Sources');
        $this->description = $this->l('Expose les landing pages et UTM sources des commandes via l\'API Webservice.');
        $this->ps_versions_compliancy = array('min' => '1.7.0.0', 'max' => _PS_VERSION_);
    }

    public function install()
    {
        return parent::install()
            && $this->registerHook('addWebserviceResources');
    }

    public function uninstall()
    {
        return parent::uninstall();
    }

    /**
     * Register our custom API resource
     */
    public function hookAddWebserviceResources($params)
    {
        return array(
            'regen_order_sources' => array(
                'description' => 'Order sources with UTM parameters (REGEN AGENCY)',
                'specific_management' => true,
            ),
        );
    }
}
