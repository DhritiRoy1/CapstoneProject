document.addEventListener("DOMContentLoaded",function(){
    url_tracker = document.getElementById("url_display");
    chrome.runtime.onMessage.addListener(function(message,sender,send_response){
        if (message.type ==="URL_UPDATE"){
            url_tracker.innerText = message.url;
        }
    })
})