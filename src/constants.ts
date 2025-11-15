/** 缓存过期时间（默认30天） */
export const CACHE_EXPIRE_TIME = 30 * 24 * 60 * 60 * 1000;

/** 默认启动延迟 */
export const DEFAULT_STARTUP_DELAY = 5000;

/** 防抖延迟时间 */
export const DEBOUNCE_DELAY = 500;

/** 命令标识符 */
export const COMMANDS = {
    TOGGLE_MODE: 'hoverTranslator.toggleMode',
    RETRANSLATE: 'hoverTranslator.retranslate'
} as const;

/** 配置项键名 */
export const CONFIG_KEYS = {
    BASE_URL: 'baseURL',
    API_KEY: 'apiKey',
    MODEL: 'model',
    PROMPT_TEMPLATE: 'promptTemplate',
    STARTUP_DELAY: 'startupDelay'
} as const;