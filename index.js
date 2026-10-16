/*
 * DW2 · Persona Atelier | v1.0.3
 * A presentation layer for TT's native Persona Management.
 * Keep every TT persona node, event handler, filter and save routine intact.
 */
const VERSION = '1.0.6';
const STYLE_CLASS = 'dw2pa-active';
const SETTINGS_ID = 'dw2pa-settings';
const SETTINGS_TOGGLE_ID = 'dw2pa-settings-toggle';
const STORAGE_KEY = 'dw2pa:enabled:v1';

let running = false;
let panelObserver = null;
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
/* View switch remains visible in native mode so it can always be reversed. */
const MODE_TOGGLE_ID = 'dw2pa-mode-toggle';
const TOOLS_TOGGLE_ID = 'dw2pa-tools-toggle';
const TOOLS_TRAY_ID = 'dw2pa-tools-tray';
const ACTIONS_TOGGLE_ID = 'dw2pa-actions-toggle';
const ACTIONS_CONTENT_ID = 'dw2pa-persona-actions';
const TOOL_OPEN_KEY = 'dw2pa:tools:open:v1';
const ACTION_OPEN_KEY = 'dw2pa:actions:open:v1';
const GLOBAL_OPEN_KEY = 'dw2pa:global:open:v1';
const GLOBAL_TOGGLE_ID = 'dw2pa-global-toggle';
const CONNECTION_LAYOUT_ID = 'dw2pa-connections-layout';
const INSERT_SECTION_ID = 'dw2pa-insert-settings';
const INSERT_TOGGLE_ID = 'dw2pa-insert-toggle';
const INSERT_CONTENT_ID = 'dw2pa-insert-content';
const INSERT_OPEN_KEY = 'dw2pa:insert:open:v1';
let movedConnections = [];
let movedInsertion = [];
let insertedContentId = false;
let movedTools = [];
let namedNativeButtons = false;

function getOpen(key) {
    try { return localStorage.getItem(key) === '1'; }
    catch { return false; }
}
function saveOpen(key, value) {
    try { localStorage.setItem(key, value ? '1' : '0'); }
    catch { /* UI still responds in this session. */ }
}
function syncToggle() {
    const checkbox = document.getElementById(SETTINGS_TOGGLE_ID);
    if (checkbox) checkbox.checked = isStyled();
    const toggle = document.getElementById(MODE_TOGGLE_ID);
    if (toggle) {
        toggle.setAttribute('aria-pressed', String(isStyled()));
        toggle.textContent = isStyled() ? 'ATELIER VIEW' : 'NATIVE VIEW';
        toggle.title = isStyled() ? '返回 TT 原生人设外观' : '切换到 DW2 人设工坊';
    }
}
function mountModeToggle() {
    const title = document.querySelector('#PersonaManagement > .flex-container > .flex-container:first-child h3');
    if (!title) return false;
    if (document.getElementById(MODE_TOGGLE_ID)) return true;
    const toggle = document.createElement('button');
    toggle.id = MODE_TOGGLE_ID;
    toggle.type = 'button';
    toggle.addEventListener('click', () => {
        const enabled = !isStyled();
        writePreference(enabled);
        applyStyle(enabled);
    });
    title.after(toggle);
    syncToggle();
    return true;
}
function openToolTray(open) {
    const toggle = document.getElementById(TOOLS_TOGGLE_ID);
    const tray = document.getElementById(TOOLS_TRAY_ID);
    if (!toggle || !tray) return;
    toggle.setAttribute('aria-expanded', String(open));
    tray.hidden = !open;
    toggle.classList.toggle('dw2pa-is-expanded', open);
}
function mountToolTray() {
    if (document.getElementById(TOOLS_TRAY_ID)) return true;
    const panel = document.getElementById('PersonaManagement');
    const row = panel?.querySelector('.persona_management_left_column > .flex-container:first-child');
    const tools = [
        panel?.querySelector('.user_stats_button'),
        document.getElementById('personas_backup'),
        document.getElementById('personas_restore'),
        document.getElementById('create_dummy_persona'),
        document.getElementById('persona_grid_toggle'),
    ];
    const nativePager = document.getElementById('persona_pagination_container');
    if (!row || !nativePager || tools.some(node => !node)) return false;

    const toggle = document.createElement('button');
    toggle.id = TOOLS_TOGGLE_ID;
    toggle.type = 'button';
    toggle.textContent = '工具与管理';
    toggle.setAttribute('aria-controls', TOOLS_TRAY_ID);
    toggle.addEventListener('click', () => {
        const next = toggle.getAttribute('aria-expanded') !== 'true';
        saveOpen(TOOL_OPEN_KEY, next);
        openToolTray(next);
    });

    const tray = document.createElement('div');
    tray.id = TOOLS_TRAY_ID;
    tray.setAttribute('aria-label', '人设管理原生工具');
    row.append(toggle);
    row.after(tray);

    const labels = ['使用统计', '备份', '恢复', '创建', '排列视图'];
    for (let index = 0; index < tools.length; index++) {
        const node = tools[index];
        // A placeholder records the exact native location, preserving order
        // and TT's original event handlers when returning to native view.
        const anchor = document.createComment('dw2pa original tool position');
        node.before(anchor);
        movedTools.push({ node, anchor, parent: anchor.parentNode });
        const item = document.createElement('div');
        item.className = 'dw2pa-tool-item';
        item.append(node);
        // Grid view's native icon has no visible label.
        if (index === 4) {
            const caption = document.createElement('span');
            caption.className = 'dw2pa-tool-caption';
            caption.textContent = labels[index];
            item.append(caption);
        }
        tray.append(item);
    }

    // Put TT's *real* pagination host on a dedicated second row. The
    // pagination.js instance and all handlers remain owned by TT.
    const pageAnchor = document.createComment('dw2pa original pager position');
    nativePager.before(pageAnchor);
    movedTools.push({ node: nativePager, anchor: pageAnchor, parent: pageAnchor.parentNode });
    const pagerRow = document.createElement('div');
    pagerRow.className = 'dw2pa-pager-row';
    pagerRow.append(nativePager);
    tray.append(pagerRow);

    openToolTray(getOpen(TOOL_OPEN_KEY));
    return true;
}
function restoreToolTray() {
    for (const { node, anchor, parent } of movedTools) {
        if (anchor.parentNode) anchor.replaceWith(node);
        else if (parent?.isConnected) parent.append(node);
    }
    movedTools = [];
    document.getElementById(TOOLS_TOGGLE_ID)?.remove();
    document.getElementById(TOOLS_TRAY_ID)?.remove();
}
function openPersonaActions(open) {
    const controls = document.getElementById('persona_controls');
    const toggle = document.getElementById(ACTIONS_TOGGLE_ID);
    if (!controls || !toggle) return;
    controls.classList.toggle('dw2pa-actions-collapsed', !open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '收起操作' : '人设操作';
}
function mountPersonaActions() {
    if (document.getElementById(ACTIONS_TOGGLE_ID)) return true;
    const controls = document.getElementById('persona_controls');
    const name = document.getElementById('your_name');
    const nativeButtons = controls?.querySelector('.persona_controls_buttons_block');
    if (!controls || !name || !nativeButtons) return false;

    if (!nativeButtons.id) {
        nativeButtons.id = ACTIONS_CONTENT_ID;
        namedNativeButtons = true;
    }
    const toggle = document.createElement('button');
    toggle.id = ACTIONS_TOGGLE_ID;
    toggle.type = 'button';
    toggle.setAttribute('aria-controls', nativeButtons.id);
    toggle.addEventListener('click', () => {
        const next = toggle.getAttribute('aria-expanded') !== 'true';
        saveOpen(ACTION_OPEN_KEY, next);
        openPersonaActions(next);
    });
    name.after(toggle);
    openPersonaActions(getOpen(ACTION_OPEN_KEY));
    return true;
}
function restorePersonaActions() {
    document.getElementById('persona_controls')?.classList.remove('dw2pa-actions-collapsed');
    document.getElementById(ACTIONS_TOGGLE_ID)?.remove();
    if (namedNativeButtons) {
        document.getElementById(ACTIONS_CONTENT_ID)?.removeAttribute('id');
        namedNativeButtons = false;
    }
}
/* Group the original TT binding controls around a left-hand avatar preview.
   Moving the actual DOM nodes preserves event listeners, data and rerender IDs.
   The comment anchors allow exact native restoration on view switch/disable. */
function mountConnectionLayout() {
    if (document.getElementById(CONNECTION_LAYOUT_ID)) return true;
    const buttons = document.getElementById('persona_connections_buttons');
    const info = document.getElementById('persona_connections_info_block');
    const avatars = document.getElementById('persona_connections_list');
    const root = buttons?.parentNode;
    if (!root || !info || !avatars || info.parentNode !== root || avatars.parentNode !== root) return false;
    const layout = document.createElement('div');
    layout.id = CONNECTION_LAYOUT_ID;
    buttons.before(layout);
    for (const node of [avatars, buttons, info]) {
        const anchor = document.createComment('dw2pa original connection position');
        node.before(anchor);
        movedConnections.push({ node, anchor, parent: anchor.parentNode });
        layout.append(node);
    }
    return true;
}
function restoreConnectionLayout() {
    for (const { node, anchor, parent } of movedConnections) {
        if (anchor.parentNode) anchor.replaceWith(node);
        else if (parent?.isConnected) parent.append(node);
    }
    movedConnections = [];
    document.getElementById(CONNECTION_LAYOUT_ID)?.remove();
}
/* Insertion position belongs to the current Persona, not TT global settings.
   The existing Position header includes a live native token counter.
   Preserve both original nodes and all change listeners with comment anchors. */
function openInsertSettings(open) {
    const section = document.getElementById(INSERT_SECTION_ID);
    const toggle = document.getElementById(INSERT_TOGGLE_ID);
    if (!section || !toggle) return;
    section.classList.toggle('dw2pa-insert-collapsed', !open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '收起' : '展开';
}
function mountInsertSettings() {
    if (document.getElementById(INSERT_SECTION_ID)) return true;
    const content = document.querySelector('#PersonaManagement .persona_management_description_position_container');
    const header = content?.previousElementSibling;
    if (!content || !header || header.tagName !== 'DIV'
        || !header.querySelector('h4') || header.parentNode !== content.parentNode) return false;

    const section = document.createElement('section');
    section.id = INSERT_SECTION_ID;
    header.before(section);
    for (const node of [header, content]) {
        const anchor = document.createComment('dw2pa original insertion position');
        node.before(anchor);
        movedInsertion.push({ node, anchor, parent: anchor.parentNode });
        section.append(node);
    }
    if (!content.id) {
        content.id = INSERT_CONTENT_ID;
        insertedContentId = true;
    }
    const toggle = document.createElement('button');
    toggle.id = INSERT_TOGGLE_ID;
    toggle.type = 'button';
    toggle.setAttribute('aria-label', '展开或收起人设插入位置');
    toggle.setAttribute('aria-controls', content.id);
    toggle.addEventListener('click', () => {
        const next = toggle.getAttribute('aria-expanded') !== 'true';
        saveOpen(INSERT_OPEN_KEY, next);
        openInsertSettings(next);
    });
    header.append(toggle);
    openInsertSettings(getOpen(INSERT_OPEN_KEY));
    return true;
}
function restoreInsertSettings() {
    document.getElementById(INSERT_TOGGLE_ID)?.remove();
    if (insertedContentId) {
        document.getElementById(INSERT_CONTENT_ID)?.removeAttribute('id');
        insertedContentId = false;
    }
    for (const { node, anchor, parent } of movedInsertion) {
        if (anchor.parentNode) anchor.replaceWith(node);
        else if (parent?.isConnected) parent.append(node);
    }
    movedInsertion = [];
    document.getElementById(INSERT_SECTION_ID)?.remove();
}
function openGlobalSettings(open) {
    const section = document.querySelector('#PersonaManagement .persona_management_global_settings');
    const toggle = document.getElementById(GLOBAL_TOGGLE_ID);
    if (!section || !toggle) return;
    section.classList.toggle('dw2pa-global-collapsed', !open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '收起' : '展开';
}
function mountGlobalSettings() {
    if (document.getElementById(GLOBAL_TOGGLE_ID)) return true;
    const section = document.querySelector('#PersonaManagement .persona_management_global_settings');
    const title = section?.querySelector(':scope > h4.standoutHeader');
    if (!title) return false;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = GLOBAL_TOGGLE_ID;
    toggle.setAttribute('aria-label', '展开或收起全局设置');
    toggle.addEventListener('click', () => {
        const next = toggle.getAttribute('aria-expanded') !== 'true';
        saveOpen(GLOBAL_OPEN_KEY, next);
        openGlobalSettings(next);
    });
    title.append(toggle);
    openGlobalSettings(getOpen(GLOBAL_OPEN_KEY));
    return true;
}
function restoreGlobalSettings() {
    document.querySelector('#PersonaManagement .persona_management_global_settings')
        ?.classList.remove('dw2pa-global-collapsed');
    document.getElementById(GLOBAL_TOGGLE_ID)?.remove();
}
function applyStyle(enabled) {
    const active = Boolean(running && enabled);
    if (active) {
        mountToolTray();
        mountPersonaActions();
        mountGlobalSettings();
        mountConnectionLayout();
        mountInsertSettings();
    } else {
        restoreToolTray();
        restorePersonaActions();
        restoreGlobalSettings();
        restoreConnectionLayout();
        restoreInsertSettings();
    }
    document.body?.classList.toggle(STYLE_CLASS, active);
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
            if (install.info.isUpToDate === true) {
                message.textContent = '已是最新版（v' + VERSION + '）。';
            } else if (install.info.isUpToDate === false) {
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

/* Startup is intentionally lightweight. The native TT persona drawer starts
   closed, so there is no reason to reparent its controls or build panels on
   every launch while Story Archive is preparing the home screen.
   Watch the drawer's class only, never the whole document's subtree. */
function initializeVisiblePersona() {
    if (!running) return;
    const panel = document.getElementById('PersonaManagement');
    if (!panel || panel.classList.contains('closedDrawer')) return;
    // Only initialize once. Switching views is handled by the user's buttons.
    if (!document.getElementById(MODE_TOGGLE_ID)) {
        mountModeToggle();
        applyStyle(readPreference());
    }
}
function mountWhenReady() {
    if (!running) return;
    // A class change is cheap; the CSS is entirely scoped to PersonaManagement.
    document.body?.classList.toggle(STYLE_CLASS, readPreference());
    mountSettings();
    syncToggle();
    const panel = document.getElementById('PersonaManagement');
    if (panel && !panelObserver) {
        panelObserver = new MutationObserver(initializeVisiblePersona);
        panelObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });
    }
    initializeVisiblePersona();
}

export function onEnable() {
    if (running) return;
    running = true;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountWhenReady, { once: true });
    } else {
        mountWhenReady();
    }
}

export function onDisable() {
    running = false;
    panelObserver?.disconnect();
    panelObserver = null;
    applyStyle(false);
    document.getElementById(MODE_TOGGLE_ID)?.remove();
    document.getElementById(SETTINGS_ID)?.remove();
}

/* Keep TT's manifest hooks and its direct module initialization compatible. */
onEnable();
