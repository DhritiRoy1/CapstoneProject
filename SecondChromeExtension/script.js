/*
chrome.webRequest.onBeforeRequest.addListener(
    function(details){
        // 1. chrome.runtime.sendMessage is now given an anonymous callback function.        chrome.runtime.sendMessage({
            type: "URL_UPDATE",
            url: details.url
        }, () => {
             // 2. The error check MUST go inside this callback.
             if (chrome.runtime.lastError) {
                 // This block handles the "Receiving end does not exist" error silently.
                 // This is the expected behavior when the popup is closed.
                 console.log("No open listener for URL_UPDATE:", chrome.runtime.lastError.message);
                 return;
             }
             // Optional: Handle the response from the popup here if you need one
        });
        
        // 3. The check here is removed, as it executes too early.
    },
    {urls: ["<all_urls>"]},
    []
);
*/
async function getCurrentTab() {
        let queryOptions = { active: true, lastFocusedWindow: true };
        // `tab` will either be a `tabs.Tab` instance or `undefined`.
        let [tab] = await chrome.tabs.query(queryOptions);
        if (tab && tab.url){
            console.log(tab.url);
        }
        
       
}
setInterval(getCurrentTab,2000);

