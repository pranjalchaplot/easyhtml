document.addEventListener('DOMContentLoaded', function() {
    const htmlInput = document.getElementById('htmlInput');
    const htmlOutput = document.getElementById('htmlOutput');
    const copyBtn = document.getElementById('copyBtn');
    const formatBtn = document.getElementById('formatBtn');
    const clearBtn = document.getElementById('clearBtn');
    const newTabBtn = document.getElementById('newTabBtn');
    const formatMode = document.getElementById('formatMode');
    const jumpToTopBtn = document.getElementById('jumpToTop');
    const jumpToBottomBtn = document.getElementById('jumpToBottom');
    let scrollTimeout;
    let scrollThreshold = 0; // Default threshold for showing buttons (in pixels)
    let hideDelay = 1400; // Default delay before hiding buttons (in milliseconds)

    // Configurable properties (can be saved to storage)
    chrome.storage.local.get(['scrollThreshold', 'hideDelay'], function(result) {
      if (result.scrollThreshold) scrollThreshold = result.scrollThreshold;
      if (result.hideDelay) hideDelay = result.hideDelay;
    });

    function toggleScrollButton(){
      const scrollPosition = htmlInput.scrollTop;
      const maxScroll = htmlInput.scrollHeight - htmlInput.clientHeight;
      
      // Clear any existing timeout
      clearTimeout(scrollTimeout);
      
      // Show/hide appropriate buttons based on scroll position
      if (scrollPosition >= scrollThreshold) {
        jumpToTopBtn.style.opacity = '1';
      } else {
        jumpToTopBtn.style.opacity = '0';
      }
      
      if (maxScroll - scrollPosition > scrollThreshold) {
        jumpToBottomBtn.style.opacity = '1';
      } else {
        jumpToBottomBtn.style.opacity = '0';
      }
      
      // Set timeout to hide buttons after delay
      scrollTimeout = setTimeout(function() {
        jumpToTopBtn.style.opacity = '0';
        jumpToBottomBtn.style.opacity = '0';
      }, hideDelay);
    }
      

    htmlInput.addEventListener('scroll', toggleScrollButton);

    // Button click handlers
    jumpToTopBtn.addEventListener('click', function() {
      htmlInput.scrollTop = 0;
    });

    jumpToBottomBtn.addEventListener('click', function() {
      htmlInput.scrollTop = htmlInput.scrollHeight;
    });

    // Update SVG colors based on dark mode
    function updateScrollButtonSvgColors() {
      const isDarkMode = document.body.classList.contains('dark-mode');
      const buttons = [jumpToTopBtn, jumpToBottomBtn];
      
      buttons.forEach(button => {
        const paths = button.querySelectorAll('path');
        paths.forEach(path => {
          path.setAttribute('stroke', isDarkMode ? 'white' : 'black');
        });
      });
    }

    // Function to save scroll settings
    function saveScrollSettings(threshold, delay) {
      chrome.storage.local.set({
        scrollThreshold: threshold,
        hideDelay: delay
      });
    }

    // Format mode state (0: Indented, 1: Left-aligned, 2: Compact)
    let currentFormatMode = 0;
    const formatModes = ['Indented', 'Left-aligned', 'Compact'];

    // Load saved content and format mode
    chrome.storage.local.get(['htmlContent', 'formatMode', 'pageSource'], function(result) {
      if (result.pageSource) {
        htmlInput.value = result.pageSource;
        chrome.storage.local.remove('pageSource');
        updatePreview();
      }
      else if (result.htmlContent) {
        htmlInput.value = result.htmlContent;
        updatePreview();
      }

      if (result.formatMode !== undefined) {
        currentFormatMode = result.formatMode;
        updateFormatModeIndicator();
      }
    });

    chrome.storage.local.get('pageSource', (data) => {
      if (data.pageSource) {
        htmlInput.value = data.pageSource;
        // Optionally, clear the stored source after using it
        chrome.storage.local.remove('pageSource');
      }
    });

    // Update preview on input
    htmlInput.addEventListener('input', function() {
      updatePreview();
      saveContent();
    });

    // Format button click
    formatBtn.addEventListener('click', function() {
      // Cycle through format modes
      currentFormatMode = (currentFormatMode + 1) % 3;
      updateFormatModeIndicator();
      formatHTML();
      showButtonFeedback(formatBtn);

      // Save current format mode
      chrome.storage.local.set({formatMode: currentFormatMode});
    });

    // Copy button click
    copyBtn.addEventListener('click', function() {
      copyToClipboard();
      showButtonFeedback(copyBtn);
    });

    // Clear button click
    clearBtn.addEventListener('click', function() {
      clearHTML();
      showButtonFeedback(clearBtn);
    });

    // New Tab button click
    newTabBtn.addEventListener('click', function() {
      openInNewTab();
    });

    // Function to update format mode indicator
    function updateFormatModeIndicator() {
      formatMode.textContent = `Format: ${formatModes[currentFormatMode]}`;
    }

    // Function to provide visual feedback when buttons are clicked
    function showButtonFeedback(button) {
      button.classList.add('active');
      setTimeout(() => {
        button.classList.remove('active');
      }, 500);
    }

    function sanitizeHTML(html) {
      // Create a new div element
      const tempDiv = document.createElement('div');
      // Set the HTML content
      tempDiv.innerHTML = html;
      
      // Remove all script tags
      const scripts = tempDiv.querySelectorAll('script');
      scripts.forEach(script => script.remove());
      
      // Remove all on* attributes from all elements
      const allElements = tempDiv.getElementsByTagName('*');
      for (let i = 0; i < allElements.length; i++) {
        const attributes = allElements[i].attributes;
        for (let j = 0; j < attributes.length; j++) {
          if (attributes[j].name.startsWith('on')) {
            allElements[i].removeAttribute(attributes[j].name);
            j--; // Adjust index since we removed an attribute
          }
        }
      }
      
      return tempDiv.innerHTML;
    }

    function updatePreview() {
      const html = htmlInput.value;
      const safeHTML = sanitizeHTML(html);
      const iframe = document.getElementById("htmlOutput");
      const doc = iframe.contentDocument || iframe.contentWindow.document;
    
      // Clear existing content
      while (doc.firstChild) {
        doc.removeChild(doc.firstChild);
      }
    
      // Write the sanitized HTML
      doc.open();
      doc.write(safeHTML);
      doc.close();
    }

    // Function to clear HTML input
    function clearHTML() {
      htmlInput.value = '';
      updatePreview();
      saveContent();
    }

    // Function to format HTML based on current mode
    function formatHTML() {
      try {
        const html = htmlInput.value;
        if (!html.trim()) return;

        let formatted;

        switch(currentFormatMode) {
          case 0: // Indented
            // Parse and format HTML with indentation
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            formatted = formatNode(doc.documentElement, 0);
            break;

          case 1: // Left-aligned
            // Parse and format HTML without indentation (all left-aligned)
            formatted = formatLeftAligned(html);
            break;

          case 2: // Compact
            // Remove all unnecessary whitespace
            formatted = formatCompact(html);
            break;
        }

        // Set the formatted HTML back to the input
        htmlInput.value = formatted;

        // Update preview
        updatePreview();

        // Save content
        saveContent();
      } catch (error) {
        console.error('Formatting error:', error);
      }
    }

    // Function to format HTML with left alignment
    function formatLeftAligned(html) {
      // Parse the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Format with line breaks but no indentation
      return formatNodeLeftAligned(doc.documentElement);
    }

    // Helper function for left-aligned formatting
    function formatNodeLeftAligned(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        return text.length > 0 ? text : '';
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const tagName = node.tagName.toLowerCase();

      // Check for inline elements
      const inlineTags = ['span', 'a', 'strong', 'em', 'b', 'i', 'code', 'br'];
      const isInline = inlineTags.includes(tagName);

      let innerHTML = '';

      // Process child nodes
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent.trim();
          if (text.length > 0) {
            innerHTML += isInline ? text : text + '\n';
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          innerHTML += isInline ? formatNodeLeftAligned(child) : formatNodeLeftAligned(child) + '\n';
        }
      }

      // Construct attributes
      let attributes = '';
      for (const attr of node.attributes) {
        attributes += ` ${attr.name}="${attr.value}"`;
      }

      // Self-closing tags
      const selfClosingTags = ['img', 'input', 'br', 'hr', 'meta', 'link'];
      const isSelfClosing = selfClosingTags.includes(tagName) && !node.hasChildNodes();

      if (isSelfClosing) {
        return `<${tagName}${attributes} />`;
      } else if (isInline) {
        return `<${tagName}${attributes}>${innerHTML.trim()}</${tagName}>`;
      } else {
        return `<${tagName}${attributes}>\n${innerHTML}</${tagName}>`;
      }
    }

    // Function to format HTML in compact mode
    function formatCompact(html) {
      // Parse the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Return compact formatting - all on one line with minimal spacing
      return formatNodeCompact(doc.documentElement);
    }

    // Helper function for compact formatting
    function formatNodeCompact(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        // Trim and collapse whitespace
        return node.textContent.trim().replace(/\s+/g, ' ');
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const tagName = node.tagName.toLowerCase();

      let innerHTML = '';

      // Process child nodes without extra whitespace
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent.trim().replace(/\s+/g, ' ');
          if (text.length > 0) {
            innerHTML += text;
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          innerHTML += formatNodeCompact(child);
        }
      }

      // Construct attributes
      let attributes = '';
      for (const attr of node.attributes) {
        attributes += ` ${attr.name}="${attr.value}"`;
      }

      // Self-closing tags
      const selfClosingTags = ['img', 'input', 'br', 'hr', 'meta', 'link'];
      const isSelfClosing = selfClosingTags.includes(tagName) && !node.hasChildNodes();

      if (isSelfClosing) {
        return `<${tagName}${attributes}/>`;
      } else {
        return `<${tagName}${attributes}>${innerHTML}</${tagName}>`;
      }
    }

    // Helper function to format HTML node with indentation
    function formatNode(node, level) {
      if (node.nodeType === Node.TEXT_NODE) {
        // Trim text nodes and return if not just whitespace
        const text = node.textContent.trim();
        return text.length > 0 ? text : '';
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const tagName = node.tagName.toLowerCase();
      const indent = '  '.repeat(level);
      const nextIndent = '  '.repeat(level + 1);

      // Skip formatting for specific tags
      const inlineTags = ['span', 'a', 'strong', 'em', 'b', 'i', 'code', 'br'];
      const isInline = inlineTags.includes(tagName);

      let innerHTML = '';
      let hasTextContent = false;
      let hasElementContent = false;

      // Process child nodes
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent.trim();
          if (text.length > 0) {
            innerHTML += isInline ? text : nextIndent + text + '\n';
            hasTextContent = true;
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          innerHTML += isInline ? formatNode(child, 0) : nextIndent + formatNode(child, level + 1) + '\n';
          hasElementContent = true;
        }
      }

      // Construct element string
      let attributes = '';
      for (const attr of node.attributes) {
        attributes += ` ${attr.name}="${attr.value}"`;
      }

      // Determine if the tag should be self-closing
      const selfClosingTags = ['img', 'input', 'br', 'hr', 'meta', 'link'];
      const isSelfClosing = selfClosingTags.includes(tagName) && !node.hasChildNodes();

      if (isSelfClosing) {
        return `<${tagName}${attributes} />`;
      } else if (isInline || (hasTextContent && !hasElementContent)) {
        // Inline formatting for simple text content
        return `<${tagName}${attributes}>${innerHTML.trim()}</${tagName}>`;
      } else {
        // Block formatting with indentation
        return `<${tagName}${attributes}>\n${innerHTML}${indent}</${tagName}>`;
      }
    }

    // Function to copy HTML to clipboard
    function copyToClipboard() {
      htmlInput.select();
      document.execCommand('copy');
    }

    // Function to open HTML in a new tab with CSP
    function openInNewTab() {
      let html = htmlInput.value;

      // Add CSP meta tag if not already present
      let cspTag = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline';">`;

      // Check if there's a head tag
      if (html.includes("</head>")) {
        html = html.replace("</head>", cspTag + "</head>");
      } else if (html.includes("<head>")) {
        html = html.replace("<head>", "<head>" + cspTag);
      } else if (html.includes("<html")) {
        // If there's an html tag but no head, add head with CSP
        html = html.replace("<html", "<html><head>" + cspTag + "</head>");
      } else {
        // If no html structure exists, wrap the content
        html = "<!DOCTYPE html><html><head>" + cspTag + "</head><body>" + html + "</body></html>";
      }

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      chrome.tabs.create({ url: url });
    }

    // Function to save content to storage
    function saveContent() {
      chrome.storage.local.set({htmlContent: htmlInput.value});
    }

    // Initial preview update
    updatePreview();
    updateFormatModeIndicator();

    // Add mousemove and mouseleave event listeners to newTabBtn
    document.getElementById('newTabBtn').addEventListener('mousemove', function(e) {
      const btn = e.currentTarget;
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const offsetX = (centerX - x) / 10;
      const offsetY = (centerY - y) / 10;
      btn.style.boxShadow = `${offsetX}px ${offsetY}px 6px rgba(0, 0, 0, 0.1)`;
    });

    document.getElementById('newTabBtn').addEventListener('mouseleave', function(e) {
      e.currentTarget.style.boxShadow = 'none';
    });

    function toggleDarkMode() {
      document.body.classList.toggle('dark-mode');

      // Adjust SVG stroke colors based on current mode
      const svgs = document.querySelectorAll('svg');
      svgs.forEach(svg => {
        const paths = svg.querySelectorAll('path');
        paths.forEach(path => {
          if (document.body.classList.contains('dark-mode')) {
            path.setAttribute('stroke', 'white');
          } else {
            path.setAttribute('stroke', 'black');
          }
        });
      });

      if (chrome && chrome.storage) {
        chrome.storage.local.set({darkMode: document.body.classList.contains('dark-mode')});
      }

      // Toggle sun and moon icons
      const sunIcon = document.getElementById('sunIcon');
      const moonIcon = document.getElementById('moonIcon');
      const darkModeToggle = document.getElementById('darkModeToggle');

      if (document.body.classList.contains('dark-mode')) {
        sunIcon.style.opacity = '0';
        moonIcon.style.opacity = '1';
        darkModeToggle.title = 'Disable Dark Mode';
      } else {
        sunIcon.style.opacity = '1';
        moonIcon.style.opacity = '0';
        darkModeToggle.title = 'Enable Dark Mode';
      }
    }

    chrome.storage.local.get(['darkMode'], function(result) {
      if (result.darkMode) {
        document.body.classList.add('dark-mode');
        
        // Also adjust SVG strokes
        const svgs = document.querySelectorAll('svg');
        svgs.forEach(svg => {
          const paths = svg.querySelectorAll('path');
          paths.forEach(path => {
            path.setAttribute('stroke', 'white');
          });
        });
      }
    });

    // Add an event listener to the dark mode toggle button
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
});