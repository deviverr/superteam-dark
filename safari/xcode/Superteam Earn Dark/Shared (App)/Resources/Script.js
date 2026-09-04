/* Called by ViewController.swift once it knows the platform, and on macOS
   the extension's on/off state as well. Keep the signature: the Swift side
   evaluates `show('ios')`, `show('mac')` or `show('mac', <bool>, <bool>)`. */
function show(platform, enabled, useSettingsInsteadOfPreferences) {
    document.body.classList.add(`platform-${platform}`);

    // "Preferences" was renamed to "Settings" in macOS Ventura; the Swift
    // side tells us which name this system uses so the copy matches what
    // the user will actually see in the menu bar.
    if (useSettingsInsteadOfPreferences) {
        for (const el of document.querySelectorAll('.open-preferences')) {
            el.textContent = 'Quit and Open Safari Settings…';
        }
        for (const el of document.querySelectorAll('.platform-mac p')) {
            el.innerHTML = el.innerHTML.replace(/Safari’s Extensions settings/g,
                                                'the Extensions section of Safari Settings');
        }
    }

    if (typeof enabled === 'boolean') {
        document.body.classList.toggle('state-on', enabled);
        document.body.classList.toggle('state-off', !enabled);
    } else {
        document.body.classList.remove('state-on');
        document.body.classList.remove('state-off');
    }
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage('open-preferences');
}

document.querySelector('button.open-preferences').addEventListener('click', openPreferences);
