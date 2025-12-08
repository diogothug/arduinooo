
export interface Snippet {
    id: string;
    filename: string;
    title: string;
    description: string;
    code: string;
}

export const PREMIUM_SNIPPETS: Snippet[] = [
    {
        id: 'logging',
        filename: 'logs_pro.c',
        title: '1. Sistema de Logs Profissional',
        description: 'Macros ESP_LOGx para debug estruturado e colorido via serial.',
        code: `#include "esp_log.h"

// Exemplo de uso em qualquer módulo
static const char *TAG = "NET";

// Em algum ponto de inicialização
// ESP_LOGI(TAG, "Inicializando WiFi...");
// ESP_LOGW(TAG, "Sinal fraco: %d dBm", rssi);
// ESP_LOGE(TAG, "Falha ao conectar (%s)", esp_err_to_name(err));

/* Por que usar:
   - Ajuda debug em campo
   - Gera firmware “premium”, fácil de analisar
   - Evita prints crus (Serial.print) que sujam a saída
*/`
    },
    {
        id: 'watchdog',
        filename: 'watchdog_guard.c',
        title: '2. Watchdog Anti-Freeze',
        description: 'Proteção contra travamentos da CPU usando esp_task_wdt.',
        code: `#include "esp_task_wdt.h"

void app_main() {
    // Inicializa Watchdog com timeout de 10s e Panic (reset) ativado
    esp_task_wdt_init(10, true);
    
    // Adiciona a task atual (main) ao monitoramento
    esp_task_wdt_add(NULL);        

    while (true) {
        // --- Código da sua aplicação ---

        // Alimenta o cão de guarda (reset timer)
        esp_task_wdt_reset();      
        
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}`
    },
    {
        id: 'wifi',
        filename: 'wifi_resilient.c',
        title: '3. WiFi Fallback & Reconexão',
        description: 'Gerenciamento robusto de eventos WiFi com reconexão automática.',
        code: `#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "WIFI";
static int retry = 0;

static void wifi_event_handler(void *arg, esp_event_base_t base,
                               int32_t id, void *data)
{
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        ESP_LOGW(TAG, "WiFi caiu, tentando reconectar...");
        if (retry++ < 10) esp_wifi_connect();
    }
    if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        retry = 0;
        ESP_LOGI(TAG, "Conectado, IP: " IPSTR,
                 IP2STR(&((ip_event_got_ip_t*)data)->ip_info.ip));
    }
}

void wifi_init(const char *ssid, const char *pass) {
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    esp_wifi_init(&cfg);

    esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL);
    esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL);

    wifi_config_t wifi_cfg = {
        .sta = {
            .threshold = { .authmode = WIFI_AUTH_WPA2_PSK },
        },
    };
    strcpy((char*)wifi_cfg.sta.ssid, ssid);
    strcpy((char*)wifi_cfg.sta.password, pass);

    esp_wifi_set_mode(WIFI_MODE_STA);
    esp_wifi_set_config(WIFI_IF_STA, &wifi_cfg);
    esp_wifi_start();
    esp_wifi_connect();
}`
    },
    {
        id: 'ota',
        filename: 'ota_native.c',
        title: '4. OTA Nativo Minimalista',
        description: 'Atualização remota segura via HTTPS em uma única função.',
        code: `#include "esp_https_ota.h"
#include "esp_log.h"
#include "esp_system.h"

static const char *TAG = "OTA";

void perform_ota(const char *url) {
    esp_http_client_config_t http_config = {
        .url = url,
        .timeout_ms = 8000,
        // .cert_pem = (char *)server_cert_pem_start, // Recomendado para HTTPS
    };

    esp_https_ota_config_t ota_config = {
        .http_config = &http_config,
        .bulk_flash_erase = true,   // Recomendação Espressif para performance
    };

    ESP_LOGI(TAG, "Iniciando OTA... %s", url);
    esp_err_t ret = esp_https_ota(&ota_config);

    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "OTA OK! Reiniciando sistema...");
        esp_restart();
    } else {
        ESP_LOGE(TAG, "Falha OTA: %s", esp_err_to_name(ret));
    }
}`
    },
    {
        id: 'task',
        filename: 'task_pattern.c',
        title: '5. Task Scheduler Padrão',
        description: 'Modelo de Task FreeRTOS com nome, stack e core definidos.',
        code: `#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"

void example_task(void *param) {
    // Converte MS para Ticks uma única vez
    const TickType_t delay = pdMS_TO_TICKS(1000);

    while (true) {
        ESP_LOGI("EXAMPLE_TASK", "Alive!");
        vTaskDelay(delay);
    }
}

void app_main() {
    // Criação da Task fixada no Core 1 (Application Core)
    // Core 0 geralmente é usado pelo WiFi/System
    xTaskCreatePinnedToCore(
        example_task,   // Função
        "example",      // Nome (debug)
        4096,           // Stack Size (bytes)
        NULL,           // Parametros
        5,              // Prioridade
        NULL,           // Handle
        1               // Core ID
    );
}`
    },
    {
        id: 'config',
        filename: 'config_manager.c',
        title: '6. Gerenciador de Configuração',
        description: 'Estrutura centralizada para configurações do dispositivo.',
        code: `#include <string.h>

typedef struct {
    char wifi_ssid[32];
    char wifi_pass[64];
    char update_url[160];
    int led_brightness;
    bool active;
} device_config_t;

device_config_t config;

void load_config() {
    // Exemplo: Carregar valores padrão. 
    // Em produção: Ler de NVS ou SPIFFS/LittleFS
    strcpy(config.wifi_ssid, "MinhaRede");
    strcpy(config.wifi_pass, "senha123");
    strcpy(config.update_url, "https://meuservidor.com/fw.bin");
    config.led_brightness = 128;
    config.active = true;
}

void apply_config() {
    // Aplica configurações aos módulos
    // wifi_init(config.wifi_ssid, config.wifi_pass);
}
`
    },
    {
        id: 'safe',
        filename: 'anti_crash.c',
        title: '7. Anti-Crash (Modo Seguro)',
        description: 'Macros e helpers para evitar panics e loops de erro.',
        code: `#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

// Helper para delays seguros mínimos (evita WDT trigger por delay 0)
void safe_delay(int ms) {
    if (ms < 5) ms = 5;
    vTaskDelay(pdMS_TO_TICKS(ms));
}

// Macro para checagem segura de erros ESP-IDF
#define SAFE(x) do { \
    esp_err_t __err = (x); \
    if (__err != ESP_OK) { \
        ESP_LOGE("ERR", "%s:%d %s", __FILE__, __LINE__, esp_err_to_name(__err)); \
    } \
} while(0)

// Uso:
// SAFE( esp_wifi_start() );
`
    },
    {
        id: 'rollback',
        filename: 'ota_rollback.c',
        title: '8. Auto-Rollback Firmware',
        description: 'Validação de boot para reverter updates defeituosos automaticamente.',
        code: `#include "esp_ota_ops.h"
#include "esp_log.h"

void validate_firmware() {
    // Execute seus testes de self-check aqui (ex: conectar wifi, checar sensor)
    bool tests_passed = true; 

    if (tests_passed) {
        // Marca app como válido. Se não chamar isso, o ESP32 reverte no próximo boot (se configurado)
        esp_ota_mark_app_valid_cancel_rollback();
        ESP_LOGI("OTA", "Firmware validado e confirmado.");
    } else {
        ESP_LOGE("OTA", "Falha na validação! Iniciando rollback...");
        esp_ota_mark_app_invalid_rollback_and_reboot();
    }
}`
    },
    {
        id: 'scheduler',
        filename: 'event_scheduler.c',
        title: '9. Scheduler de Eventos',
        description: 'Sistema de eventos assíncronos para desacoplar módulos.',
        code: `#include "esp_event.h"
#include "esp_log.h"

// Declaração da Base de Eventos
ESP_EVENT_DECLARE_BASE(SYS_EVENTS);
ESP_EVENT_DEFINE_BASE(SYS_EVENTS);

enum {
    EVT_WIFI_OK,
    EVT_WIFI_FAIL,
    EVT_SENSOR_UPDATE,
};

// Loop de processamento de eventos
void event_loop_task(void *arg) {
    esp_event_loop_handle_t loop = (esp_event_loop_handle_t)arg;
    esp_event_base_t base;
    int32_t id;
    void *data;

    while (1) {
        // Aguarda eventos indefinidamente
        if (esp_event_wait(loop, &base, &id, &data, portMAX_DELAY) == ESP_OK) {
            ESP_LOGI("EVENT", "Evento recebido ID: %ld", id);
            
            // Dispatch para lógica específica
            if (id == EVT_WIFI_OK) { /* ... */ }
        }
    }
}`
    },
    {
        id: 'rmt',
        filename: 'led_rmt_driver.c',
        title: '10. Driver LED RMT (Non-Blocking)',
        description: 'Controle de WS2812B usando periférico RMT sem travar a CPU.',
        code: `#include "led_strip.h"
#include "driver/rmt.h"

led_strip_handle_t strip;

void leds_init() {
    // Configuração do Strip
    led_strip_config_t strip_config = {
        .strip_gpio_num = 5,   // Pino GPIO
        .max_leds = 60,        // Quantidade
        .led_pixel_format = LED_PIXEL_FORMAT_GRB, 
        .led_model = LED_MODEL_WS2812,
        .flags.invert_out = false, 
    };
    
    // Configuração RMT
    led_strip_rmt_config_t rmt_config = {
        .clk_src = RMT_CLK_SRC_DEFAULT, 
        .resolution_hz = 10 * 1000 * 1000, // 10MHz
        .flags.with_dma = false,
    };

    // Inicializa driver
    ESP_ERROR_CHECK(led_strip_new_rmt_device(&strip_config, &rmt_config, &strip));
    led_strip_clear(strip);
}

void leds_set(int i, uint8_t r, uint8_t g, uint8_t b) {
    led_strip_set_pixel(strip, i, r, g, b);
}

void leds_show() {
    led_strip_refresh(strip);
}`
    },
    {
        id: 'ota_secure',
        filename: 'secure_ota_manager.c',
        title: '11. OTA Enterprise (Secure)',
        description: 'OTA Premium com TLS, Validação de Certificado, SHA-256 e Rollback.',
        code: `#include "esp_ota_ops.h"
#include "esp_https_ota.h"
#include "esp_log.h"
#include "esp_partition.h"

static const char *TAG = "SECURE_OTA";

// Certificado do Servidor (PEM)
// Pode ser embedado via CMake (embedding binary data)
extern const char server_cert_pem_start[] asm("_binary_ca_cert_pem_start");
extern const char server_cert_pem_end[]   asm("_binary_ca_cert_pem_end");

esp_err_t run_secure_ota(const char *url) {
    ESP_LOGI(TAG, "Iniciando Secure OTA...");

    esp_http_client_config_t config = {
        .url = url,
        .cert_pem = server_cert_pem_start, // Habilita Verificação TLS
        .timeout_ms = 10000,
        .keep_alive_enable = true,
        .skip_cert_common_name_check = false, // Enforce CN Check
    };

    esp_https_ota_config_t ota_config = {
        .http_config = &config,
        // Otimização: Apaga flash em blocos (rápido)
        .bulk_flash_erase = true, 
        // Partial Update: Permite download em chunks se RAM for pouca
        .partial_http_download = true,
    };

    esp_err_t ret = esp_https_ota(&ota_config);
    
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "Download e Escrita OK. Preparando Reboot...");
        
        // Verificação final da partição (opcional, esp_https_ota já faz)
        const esp_partition_t *update_partition = esp_ota_get_next_update_partition(NULL);
        if (update_partition) {
             ESP_LOGI(TAG, "Próximo boot será na partição: %s", update_partition->label);
        }
        
        esp_restart();
    } else {
        ESP_LOGE(TAG, "Falha Fatal OTA: %s", esp_err_to_name(ret));
        
        // Se falhou durante a validação da imagem
        if (ret == ESP_ERR_OTA_VALIDATE_FAILED) {
            ESP_LOGE(TAG, "Imagem corrompida ou assinatura inválida (Secure Boot).");
        }
        return ret;
    }
    return ESP_OK;
}`
    },
    {
        id: 'partitions',
        filename: 'partitions.csv',
        title: '12. Tabela de Partição OTA',
        description: 'Layout CSV obrigatório para OTA (Factory, OTA_0, OTA_1).',
        code: `# Name,   Type, SubType, Offset,  Size, Flags
# Bootloader e Tabela de Partição (gerados auto)
# nvs: Armazenamento não volátil (WiFi, Configs)
nvs,      data, nvs,     ,        0x4000,
# otadata: Controla qual partição (ota_0/ota_1) deve bootar
otadata,  data, ota,     ,        0x2000,
# phy_init: Dados de calibração RF
phy_init, data, phy,     ,        0x1000,

# App Partitions (Dual Bank para Fallback)
# factory: Firmware original de fábrica (opcional, pode ser removido para ganhar espaço)
factory,  app,  factory, ,        1M,

# ota_0: Slot A de atualização
ota_0,    app,  ota_0,   ,        1536K,

# ota_1: Slot B de atualização
ota_1,    app,  ota_1,   ,        1536K,

# Espaço livre ou SPIFFS/LittleFS para arquivos (HTML, Imagens)
# spiffs,   data, spiffs,  ,        0x10000,`
    }
];
