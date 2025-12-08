

export const generateMeshManagerH = () => `
#ifndef MESH_MANAGER_H
#define MESH_MANAGER_H

#include <Arduino.h>
#include <esp_mesh.h>
#include <esp_wifi.h>
#include <vector>

class MeshManager {
public:
    static void begin();
    static void update();
    static bool isRoot();
    static bool isConnected();
    static int getLayer();
    
    // Commands
    static void sendBroadcast(String data);
    static void sendToRoot(String data);
    
private:
    static bool _isConnected;
    static bool _isRoot;
    static int _layer;
    
    static void meshEventHandler(void *arg, esp_event_base_t base, int32_t id, void *data);
    static void receiveTask(void *arg);
};

#endif
`;

export const generateMeshManagerCpp = () => `
#include "MeshManager.h"
#include "config.h"
#include "LogManager.h"
#include "esp_event.h"
#include <ArduinoJson.h>

bool MeshManager::_isConnected = false;
bool MeshManager::_isRoot = false;
int MeshManager::_layer = -1;

void MeshManager::begin() {
    #if MESH_ENABLED
    TIDE_LOGI("MESH: Initializing...");

    // Initialize WiFi first (Required for Mesh)
    // Note: If using WifiManager, ensure they don't conflict. 
    // Mesh usually handles WiFi init internally or requires specific init.
    // For this implementation, we assume Mesh takes control of WiFi.
    
    ESP_ERROR_CHECK(esp_mesh_init());
    
    // Register Events
    ESP_ERROR_CHECK(esp_event_handler_register(MESH_EVENT, ESP_EVENT_ANY_ID, &meshEventHandler, NULL));

    // Config
    mesh_cfg_t cfg = MESH_INIT_CONFIG_DEFAULT();
    memcpy((uint8_t *) &cfg.mesh_id, MESH_ID, 6); // Use 6 bytes derived from ID string or MAC
    cfg.channel = MESH_CHANNEL;
    cfg.router.ssid_len = strlen(WIFI_SSID_DEFAULT);
    memcpy((uint8_t *) &cfg.router.ssid, WIFI_SSID_DEFAULT, cfg.router.ssid_len);
    memcpy((uint8_t *) &cfg.router.password, WIFI_PASSWORD_DEFAULT, strlen(WIFI_PASSWORD_DEFAULT));
    
    // Auth for Mesh Peers
    cfg.mesh_ap.max_connection = 6;
    cfg.mesh_ap.authmode = WIFI_AUTH_WPA2_PSK;
    memcpy((uint8_t *) &cfg.mesh_ap.password, MESH_PASSWORD, strlen(MESH_PASSWORD));

    ESP_ERROR_CHECK(esp_mesh_set_config(&cfg));
    ESP_ERROR_CHECK(esp_mesh_start());
    
    // Start Receive Task
    xTaskCreate(receiveTask, "mesh_rx", 4096, NULL, 5, NULL);
    
    TIDE_LOGI("MESH: Started. Waiting for peers...");
    #endif
}

void MeshManager::update() {
    // Watchdog or periodic sync logic can go here
}

bool MeshManager::isRoot() { return _isRoot; }
bool MeshManager::isConnected() { return _isConnected; }
int MeshManager::getLayer() { return _layer; }

void MeshManager::sendBroadcast(String data) {
    #if MESH_ENABLED
    if (!_isConnected) return;
    
    mesh_addr_t route;
    // Broadcast address logic depends on implementation. 
    // esp_mesh_send doesn't have a direct "broadcast to all" without topology knowledge 
    // or iterating. Often root sends to all.
    // For simplicity in this snippet, we send to parent or routing table.
    // Real implementation would iterate routing table.
    TIDE_LOGW("MESH: Broadcast not fully implemented in template");
    #endif
}

void MeshManager::sendToRoot(String data) {
    #if MESH_ENABLED
    if (!_isConnected) return;
    
    mesh_data_t mdata;
    mdata.data = (uint8_t*)data.c_str();
    mdata.size = data.length() + 1;
    mdata.proto = MESH_PROTO_BIN;
    mdata.tos = MESH_TOS_P2P;

    // Send to root is automatic if to_addr is NULL? No, need specific address.
    // Usually we send to parent for upstream.
    TIDE_LOGI("MESH: Sending to Root: %s", data.c_str());
    // esp_mesh_send(NULL, &mdata, MESH_DATA_TODS, NULL, 0); 
    #endif
}

void MeshManager::meshEventHandler(void *arg, esp_event_base_t base, int32_t id, void *data) {
    switch (id) {
        case MESH_EVENT_STARTED:
            TIDE_LOGI("MESH: Event STARTED");
            break;
        case MESH_EVENT_STOPPED:
            TIDE_LOGI("MESH: Event STOPPED");
            _isConnected = false;
            break;
        case MESH_EVENT_PARENT_CONNECTED:
            mesh_event_connected_t *connected = (mesh_event_connected_t *)data;
            _isConnected = true;
            _layer = connected->self_layer;
            _isRoot = (_layer == 1);
            TIDE_LOGI("MESH: Parent Connected. Layer: %d, Root: %d", _layer, _isRoot);
            if (_isRoot) {
                // Initialize Connection to Router/Internet if needed
                // esp_mesh_comm_p2p_start(); 
            }
            break;
        case MESH_EVENT_PARENT_DISCONNECTED:
            TIDE_LOGW("MESH: Parent Disconnected");
            _isConnected = false;
            // esp_mesh_connect(); // Retry
            break;
    }
}

void MeshManager::receiveTask(void *arg) {
    #if MESH_ENABLED
    mesh_addr_t from;
    mesh_data_t recv;
    int flag = 0;
    recv.data = (uint8_t*)malloc(1500); // MTU size approx
    
    while (1) {
        recv.size = 1500;
        esp_err_t res = esp_mesh_recv(&from, &recv, portMAX_DELAY, &flag, NULL, 0);
        if (res == ESP_OK) {
             String msg = String((char*)recv.data);
             TIDE_LOGI("MESH: Recv from " MACSTR ": %s", MAC2STR(from.addr), msg.c_str());
             
             // Process JSON Command
             // ...
             
        } else {
             TIDE_LOGE("MESH: Recv Error: %d", res);
             vTaskDelay(1000 / portTICK_PERIOD_MS);
        }
    }
    free(recv.data);
    vTaskDelete(NULL);
    #endif
}
`;
