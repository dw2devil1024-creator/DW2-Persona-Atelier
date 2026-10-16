/*
 * DW2 · Persona Atelier | v1.0.0
 * A presentation layer for TT's native Persona Management.
 * Keep every TT persona node, event handler, filter and save routine intact.
 */
const VERSION = '1.0.0';
const STYLE_CLASS = 'dw2pa-active';
const SETTINGS_ID = 'dw2pa-settings';
const SETTINGS_TOGGLE_ID = 'dw2pa-settings-toggle';
const STORAGE_KEY = 'dw2pa:enabled:v1';

let running = false;
let startupObserver = null;
let checkedUpdate = null;
let updateBusy = false;

function readPreference() {
    try { return localStorage.getItem(STORAGE_KEY) !== '0'; }
    catch { return true; }
}
function writePreference(enabled) {
    try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); }
    catch { /* If storage is restricted, the in-session switch still works. */ }
}
function isStyled() {
    return Boolean(document.body?.classList.contains(STYLE_CLASS));
}
function syncToggle() {
    const checkbox = document.getElementById(SETTINGS_TOGGLE_ID);
    if (checkbox) checkbox.checked = isStyled();
}
function applyStyle(enabled) {
    document.body?.classList.toggle(STYLE_CLASS, Boolean(running && enabled));
    syncToggle();
}

/* No polling, native pagination replacement or mutation of persona nodes. */
function openPersonaManagement(status) {
    const panel = document.getElementById('PersonaManagement');
    const trigger = document.querySelector('#persona-management-button > .drawer-toggle');
    if (!panel || !trigger) {
        if (status) status.textContent = '还没有找到 TT 原生人设面板，请刷新酒馆后重试。';
        return;
    }
    if (panel.classList.contains('closedDrawer')) trigger.click();
    if (status) status.textContent = '已打开 TT 原生人设管理。';
}

/* TT's extension install, discover and update APIs are used only on demand. */
async function extensionApi(route, payload, method = 'POST') {
    const root = new URL('../../../../', import.meta.url);
    const main = await import(new URL('script.js', root).href);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
        const response = await fetch(new URL('api/extensions/' + route, root).href, {
            method,
            headers: main.getRequestHeaders(),
            ...(method === 'POST' ? { body: JSON.stringify(payload) } : {}),
            cache: 'no-store',
            signal: controller.signal,
        });
        if (!response.ok) throw new Error('TT 接口返回 ' + response.status);
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}
async function locateInstall() {
    const match = new URL(import.meta.url).pathname.match(/\/scripts\/extensions\/third-party\/([^/]+)\//);
    if (!match) throw new Error('未找到第三方扩展安装目录。');
    const folder = decodeURIComponent(match[1]);
    const records = await extensionApi('discover', null, 'GET');
    const record = Array.isArray(records) && records.find(entry =>
        String(entry.name).toLowerCase() === ('third-party/' + folder).toLowerCase()
        && ['global', 'local'].includes(entry.type)
    );
    if (!record) throw new Error('未找到当前扩展，请通过 TT 扩展管理检查安装位置。');
    const global = record.type === 'global';
    const info = await extensionApi('version', { extensionName: folder, global });
    if (!info?.remoteUrl || !info?.currentCommitHash) {
        throw new Error('该扩展不是有效的 Git 安装，无法在线检查更新。');
    }
    return { folder, global, info };
}

function updateButtons(content) {
    const group = document.createElement('div');
    group.className = 'dw2pa-settings-actions';
    const check = document.createElement('button');
    check.className = 'dw2pa-settings-btn';
    check.type = 'button';
    check.textContent = '检查更新';
    const update = document.createElement('button');
    update.className = 'dw2pa-settings-btn';
    update.type = 'button';
    update.disabled = true;
    update.textContent = '更新到最新版';
    const reload = document.createElement('button');
    reload.className = 'dw2pa-settings-btn';
    reload.type = 'button';
    reload.textContent = '刷新酒馆';
    reload.hidden = true;
    const message = document.createElement('p');
    message.className = 'dw2pa-settings-status';
    message.setAttribute('role', 'status');
    message.textContent = '更新由你手动确认，不会自动安装。';
    const setBusy = (busy) => {
        updateBusy = Boolean(busy);
        check.disabled = updateBusy;
        update.disabled = updateBusy || !checkedUpdate;
        reload.disabled = updateBusy;
    };

    check.addEventListener('click', async () => {
        if (updateBusy) return;
        checkedUpdate = null;
        setBusy(true);
        message.textContent = '正在通过 TT 检查 Git 仓库…';
        try {
            const install = await locateInstall();
            if (install.info.isUpToDate === true && install.info.currentBranchName === 'main') {
                message.textContent = '已是最新版（v' + VERSION + '）。';
            } else if (install.info.isUpToDate === false || install.info.currentBranchName !== 'main') {
                checkedUpdate = { folder: install.folder, global: install.global };
                message.textContent = '检测到仓库更新，可以选择手动安装。';
            } else {
                message.textContent = 'TT 没有返回明确更新状态，请在「管理扩展」中检查。';
            }
        } catch (error) {
            message.textContent = '检查失败：' + (error.message || String(error));
        } finally { setBusy(false); }
    });

    update.addEventListener('click', async () => {
        if (updateBusy || !checkedUpdate) return;
        if (!window.confirm('确认更新 DW2 · Persona Atelier？更新后需要刷新酒馆。')) return;
        const target = checkedUpdate;
        setBusy(true);
        message.textContent = '正在更新，请稍候…';
        try {
            const result = await extensionApi('update', {
                extensionName: target.folder,
                global: target.global,
            });
            checkedUpdate = null;
            if (result.isUpToDate) {
                message.textContent = '当前已是最新提交。';
            } else {
                message.textContent = '已更新' + (result.shortCommitHash ? ' · ' + result.shortCommitHash : '') + '，请刷新酒馆。';
                reload.hidden = false;
            }
        } catch (error) {
            checkedUpdate = null;
            message.textContent = '更新失败：' + (error.message || String(error));
        } finally { setBusy(false); }
    });

    reload.addEventListener('click', () => window.location.reload());
    group.append(check, update, reload);
    content.append(group, message);
}

function mountSettings() {
    const host = document.getElementById('extensions_settings2')
        || document.getElementById('extensions_settings');
    if (!host) return false;
    if (document.getElementById(SETTINGS_ID)) {
        syncToggle();
        return true;
    }

    const panel = document.createElement('div');
    panel.id = SETTINGS_ID;
    panel.className = 'extension_container';
    const drawer = document.createElement('div');
    drawer.className = 'inline-drawer';
    const heading = document.createElement('div');
    heading.className = 'inline-drawer-toggle inline-drawer-header';
    heading.tabIndex = 0;
    heading.setAttribute('role', 'button');
    heading.setAttribute('aria-expanded', 'false');
    heading.setAttribute('aria-controls', 'dw2pa-settings-content');
    const name = document.createElement('div');
    name.className = 'dw2pa-settings-title';
    const title = document.createElement('b');
    title.textContent = 'DW2 · Persona Atelier';
    const byline = document.createElement('span');
    byline.textContent = 'S.A. · DW2';
    name.append(title, byline);
    const arrow = document.createElement('i');
    arrow.className = 'inline-drawer-icon fa-solid fa-circle-chevron-down down';
    arrow.setAttribute('aria-hidden', 'true');
    heading.append(name, arrow);
    heading.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        heading.click();
    });

    const content = document.createElement('div');
    content.id = 'dw2pa-settings-content';
    content.className = 'inline-drawer-content';
    const note = document.createElement('p');
    note.className = 'dw2pa-settings-note';
    note.textContent = 'v' + VERSION + ' · DW2 人设工坊 · 独立外观';
    const option = document.createElement('label');
    option.className = 'checkbox_label dw2pa-settings-option';
    const checkbox = document.createElement('input');
    checkbox.id = SETTINGS_TOGGLE_ID;
    checkbox.type = 'checkbox';
    checkbox.checked = isStyled();
    checkbox.addEventListener('change', () => {
        writePreference(checkbox.checked);
        applyStyle(checkbox.checked);
    });
    const label = document.createElement('span');
    label.textContent = '启用人设工坊美化';
    option.append(checkbox, label);

    const open = document.createElement('button');
    open.className = 'dw2pa-settings-btn dw2pa-open-native';
    open.type = 'button';
    open.textContent = '打开人设管理  ↗';
    const tip = document.createElement('p');
    tip.className = 'dw2pa-settings-note';
    tip.textContent = '三列人设卡 · 轻玻璃编辑区 · TT 原生交互保留';
    const openStatus = document.createElement('p');
    openStatus.className = 'dw2pa-settings-status';
    openStatus.setAttribute('role', 'status');
    open.addEventListener('click', () => openPersonaManagement(openStatus));

    content.append(note, option, open, openStatus);
    updateButtons(content);
    content.append(tip);
    drawer.append(heading, content);
    panel.append(drawer);
    host.append(panel);
    syncToggle();
    return true;
}

function mountWhenReady() {
    if (!running) return;
    applyStyle(readPreference());
    const ready = Boolean(document.getElementById('PersonaManagement')) && mountSettings();
    if (ready && startupObserver) {
        startupObserver.disconnect();
        startupObserver = null;
    }
}

export function onEnable() {
    if (running) return;
    running = true;
    mountWhenReady();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountWhenReady, { once: true });
    }
    if (document.documentElement && (!document.getElementById('PersonaManagement') || !document.getElementById(SETTINGS_ID))) {
        startupObserver = new MutationObserver(mountWhenReady);
        startupObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
}

export function onDisable() {
    running = false;
    startupObserver?.disconnect();
    startupObserver = null;
    document.body?.classList.remove(STYLE_CLASS);
    document.getElementById(SETTINGS_ID)?.remove();
}

/* Keep TT's manifest hooks and its direct module initialization compatible. */
onEnable();
