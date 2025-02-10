const menuButton = document.getElementById('menuButton');
    const talkButton = document.getElementById('talkButton');
    const messageInput = document.getElementById('messageInput');
    const conversation = document.getElementById('conversation');
    const applet = document.getElementById('applet');
    const closeSettings = document.getElementById('closeSettings');
    const saveSettings = document.getElementById('saveSettings');
    const favoriteModelSelect = document.getElementById('favoriteModelSelect');
    const manualModelInput = document.getElementById('manualModelInput');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const userInfoInput = document.getElementById('userInfoInput');
    const responseInstructionsInput = document.getElementById('responseInstructionsInput');
    const aiSpeechToggle = document.getElementById('aiSpeechToggle');
    const toggleMode = document.getElementById('toggleMode');

    let recognizing = false;
    let recognition;
    let selectedModel = 'google/gemini-2.0-flash-lite-preview-02-05:free';
    let apiKey = '';
    let userInfo = '';
    let responseInstructions = '';
    let aiSpeechEnabled = true;
    let isDarkMode = false;
    let currentUtterance = null;

    function createButton(innerHTML, onClick) {
      const button = document.createElement('button');
      button.innerHTML = innerHTML;
      button.style.marginLeft = '10px';
      button.addEventListener('click', onClick);
      return button;
    }

    function sanitizeTextForSpeech(text) {
      return text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/```(.*?)```/g, 'Here is the code: $1');
    }

    function initializeSpeechRecognition() {
      if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          recognizing = true;
          updateTalkButtonText();
        };

        recognition.onend = () => {
          recognizing = false;
          updateTalkButtonText();
        };

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          messageInput.value = transcript;
          addMessage();
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
        };
      } else {
        talkButton.innerHTML = '<i class="fas fa-envelope"></i>';
        talkButton.disabled = true;
      }
    }

    function updateTalkButtonText() {
      talkButton.innerHTML = recognizing ? '<i class="fas fa-stop"></i>' : 
        (aiSpeechEnabled && 'webkitSpeechRecognition' in window ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-envelope"></i>');
    }

    function toggleApplet() {
      applet.classList.toggle('open');
    }

    function saveSettingsToLocalStorage() {
      localStorage.setItem('selectedModel', selectedModel);
      localStorage.setItem('apiKey', apiKey);
      localStorage.setItem('userInfo', userInfo);
      localStorage.setItem('responseInstructions', responseInstructions);
      localStorage.setItem('aiSpeechEnabled', aiSpeechEnabled.toString());
      localStorage.setItem('isDarkMode', isDarkMode);
    }

    async function addMessage() {
      const message = messageInput.value.trim();
      if (message) {
        appendUserMessage(message);
        messageInput.value = '';
        conversation.scrollTop = conversation.scrollHeight;

        // Show thinking indicator
        const thinkingIndicator = document.createElement('div');
        thinkingIndicator.classList.add('thinking-indicator');
        thinkingIndicator.textContent = 'Thinking...';
        conversation.appendChild(thinkingIndicator);
        conversation.scrollTop = conversation.scrollHeight;

        try {
          const aiMessageContent = await fetchAIResponse(message);
          appendAIMessage(aiMessageContent);
        } catch (error) {
          appendErrorMessage(error.message);
        } finally {
          // Remove thinking indicator
          conversation.removeChild(thinkingIndicator);
        }
      }
    }

    function appendUserMessage(message) {
      const userMessageElement = document.createElement('div');
      userMessageElement.classList.add('message', 'user-message');
      userMessageElement.textContent = message;
      conversation.appendChild(userMessageElement);
    }

    async function fetchAIResponse(message) {
      const payload = {
        model: selectedModel,
        messages: [
          { role: "system", content: `What you should know about me: ${userInfo}\nHow you will respond: ${responseInstructions}` },
          { role: "user", content: message }
        ]
      };

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data && data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
      } else {
        throw new Error('Invalid response from API');
      }
    }

    function appendAIMessage(aiMessageContent) {
      const aiMessageElement = document.createElement('div');
      aiMessageElement.classList.add('message', 'ai-message');

      // Split the response into paragraphs
      const paragraphs = aiMessageContent.split('\n').filter(p => p.trim() !== '');
      paragraphs.forEach((paragraph, index) => {
        const paragraphElement = document.createElement('p');
        paragraphElement.textContent = paragraph;

        // Create delete button for each paragraph
        const deleteButton = createButton('<i class="fas fa-trash"></i>', () => {
          paragraphElement.remove();
        });

        // Create read aloud button for each paragraph
        const readAloudButton = createButton('<i class="fas fa-volume-up"></i>', () => {
          const utterance = new SpeechSynthesisUtterance(paragraph);
          utterance.lang = 'en-US';
          speechSynthesis.speak(utterance);
        });

        paragraphElement.appendChild(deleteButton);
        paragraphElement.appendChild(readAloudButton);
        aiMessageElement.appendChild(paragraphElement);
      });

      // Create copy button
      const copyButton = createButton('<i class="fas fa-copy"></i>', () => {
        const parsedContent = paragraphs.join('\n');
        navigator.clipboard.writeText(parsedContent).then(() => {
          alert('Response copied to clipboard');
        });
      });

      aiMessageElement.appendChild(copyButton);
      conversation.appendChild(aiMessageElement);
      conversation.scrollTop = conversation.scrollHeight;

      // Render markdown for user
      aiMessageElement.innerHTML = marked.parse(aiMessageContent);

      if (aiSpeechEnabled) {
        if (currentUtterance) {
          speechSynthesis.cancel();
        }
        currentUtterance = new SpeechSynthesisUtterance(sanitizeTextForSpeech(aiMessageContent));
        currentUtterance.lang = 'en-US';
        speechSynthesis.speak(currentUtterance);
      }
    }

    function appendErrorMessage(errorMessage) {
      const errorMessageElement = document.createElement('div');
      errorMessageElement.classList.add('message', 'ai-message');
      errorMessageElement.textContent = `Error: ${errorMessage}`;
      conversation.appendChild(errorMessageElement);
      conversation.scrollTop = conversation.scrollHeight;
    }

    function toggleDarkMode() {
      document.body.classList.toggle('dark-mode');
      document.body.classList.toggle('light-mode');
      isDarkMode = !isDarkMode;
      const modeIcon = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
      toggleMode.innerHTML = modeIcon;
    }

    menuButton.addEventListener('click', toggleApplet);
    saveSettings.addEventListener('click', () => {
      selectedModel = favoriteModelSelect.value === 'manual' ? manualModelInput.value : favoriteModelSelect.value;
      apiKey = apiKeyInput.value;
      userInfo = userInfoInput.value;
      responseInstructions = responseInstructionsInput.value;
      aiSpeechEnabled = aiSpeechToggle.checked;
      apiKeyInput.style.display = 'none';
      saveSettingsToLocalStorage();
      applet.classList.remove('open');
    });

    favoriteModelSelect.addEventListener('change', () => {
      manualModelInput.style.display = favoriteModelSelect.value === 'manual' ? 'block' : 'none';
    });

    talkButton.addEventListener('click', () => {
      if (recognizing) {
        recognition.stop();
      } else if (aiSpeechEnabled && 'webkitSpeechRecognition' in window) {
        recognition.start();
      }
      speechSynthesis.cancel();
    });

    messageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        addMessage();
      }
    });

    toggleMode.addEventListener('click', toggleDarkMode);

    function initializeApp() {
      initializeSpeechRecognition();
      loadSettingsFromLocalStorage();
      updateTalkButtonText();
    }

    function loadSettingsFromLocalStorage() {
      selectedModel = localStorage.getItem('selectedModel') || selectedModel;
      apiKey = localStorage.getItem('apiKey') || '';
      userInfo = localStorage.getItem('userInfo') || '';
      responseInstructions = localStorage.getItem('responseInstructions') || '';
      aiSpeechEnabled = localStorage.getItem('aiSpeechEnabled') === 'true';
      isDarkMode = localStorage.getItem('isDarkMode') === 'true';

      favoriteModelSelect.value = selectedModel;
      apiKeyInput.value = apiKey;
      userInfoInput.value = userInfo;
      responseInstructionsInput.value = responseInstructions;
      aiSpeechToggle.checked = aiSpeechEnabled;

      if (isDarkMode) {
        document.body.classList.add('dark-mode');
        toggleMode.innerHTML = '<i class="fas fa-sun"></i>';
      } else {
        document.body.classList.add('light-mode');
        toggleMode.innerHTML = '<i class="fas fa-moon"></i>';
      }
    }

    window.onload = initializeApp;
