const enableOneClickSidePanel = () => {
    chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch(() => {
            // Chrome can briefly reject this while an unpacked extension reloads.
        })
}

chrome.runtime.onInstalled.addListener(enableOneClickSidePanel)
chrome.runtime.onStartup.addListener(enableOneClickSidePanel)
enableOneClickSidePanel()
