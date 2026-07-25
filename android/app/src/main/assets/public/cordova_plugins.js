
  cordova.define('cordova/plugin_list', function(require, exports, module) {
    module.exports = [
      {
          "id": "cordova-plugin-googleplus.GooglePlus",
          "file": "plugins/cordova-plugin-googleplus/www/GooglePlus.js",
          "pluginId": "cordova-plugin-googleplus",
        "clobbers": [
          "window.plugins.googleplus"
        ]
        }
    ];
    module.exports.metadata =
    // TOP OF METADATA
    {
      "cordova-plugin-googleplus": "8.5.2"
    };
    // BOTTOM OF METADATA
    });
    