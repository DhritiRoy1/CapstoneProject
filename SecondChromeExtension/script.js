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
// Global declaration (must be 'let' to be reassigned)
let trackingState = {}; 
chrome.storage.local.clear(function() {
    console.log("Extension local storage cleared.");
});
(async () => {
    // 1. Await the storage retrieval and declare the 'stored' variable (Fix A)
    const stored = await chrome.storage.local.get(['trackingState']); 

    // 2. Initialize the global trackingState object (Fix B)
    trackingState = stored.trackingState || {
        timeDictionary: {},
        lastActiveUrl: null,
        lastActiveTime: Date.now()
    };
    
    // 3. Save the initial state back to storage if it was just created (Fix C)
    // This is necessary to ensure the initial current time is persistent.
    await chrome.storage.local.set({ 
        "trackingState": trackingState 
    });

    // 4. Log the result
})();
async function getCurrentTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
        // Add the time spent on the PREVIOUS tab to its total.
        // time_spent is the duration the tab was active before the switch.
    const stored = await chrome.storage.local.get('trackingState');
    const trackingState = stored.trackingState; // Get the object
    const data = trackingState.lastActiveTime;
    const dictionary = trackingState.timeDictionary;
    const old_url = trackingState.lastActiveUrl;
    const time_spent = Date.now() - data;
    if (tab && tab.url && old_url!= null){
        if(dictionary[old_url] === undefined){
            dictionary[old_url] = 0
              
        }
        dictionary[old_url] += time_spent;
        //trackingState.lastActiveUrl = tab.url; 
    }
    trackingState.lastActiveTime = Date.now();
    trackingState.lastActiveUrl = tab.url;
    chrome.storage.local.set({ 
        "trackingState": trackingState 
    });
    console.log(dictionary);
}
        
            
            // Reset the timer and the instance tracking (or simplify as in the full solution

        
       

chrome.tabs.onActivated.addListener((activeInfo)=>{
    getCurrentTab();
})

