chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "easyHTML",
    title: "EasyHTML",
    contexts: ["page"]
  });

  chrome.contextMenus.create({
    id: "easyViewThisPage",
    parentId: "easyHTML",
    title: "EasyView Current Page",
    contexts: ["page"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "easyViewThisPage") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => document.documentElement.outerHTML
    }).then(results => {
      const pageSource = results[0].result;
      chrome.storage.local.set({ pageSource: pageSource }, () => {
        chrome.action.openPopup();
      });
    });
  }
});