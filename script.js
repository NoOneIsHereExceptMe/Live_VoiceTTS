document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const statusElement = document.getElementById('status');
    const recognizedTextElement = document.getElementById('recognizedText');
    const voiceSelect = document.getElementById('voiceSelect');
    const pitchSlider = document.getElementById('pitchSlider');
    const rateSlider = document.getElementById('rateSlider');
    const pitchValue = document.getElementById('pitchValue');
    const rateValue = document.getElementById('rateValue');
    
    // New audio forwarding elements
    const outputSelect = document.getElementById('outputSelect');
    const refreshOutputsBtn = document.getElementById('refreshOutputsBtn');
    const enableRecording = document.getElementById('enableRecording');
    const downloadRecordingBtn = document.getElementById('downloadRecordingBtn');
    
    // Check if browser supports Speech Recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Your browser does not support Speech Recognition. Please use Chrome, Edge, or Safari.');
        startBtn.disabled = true;
        return;
    }
    
    // Check if browser supports Speech Synthesis
    if (!('speechSynthesis' in window)) {
        alert('Your browser does not support Speech Synthesis. Please use Chrome, Edge, or Safari.');
        startBtn.disabled = true;
        return;
    }
    
    // Check if browser supports AudioContext and MediaDevices for audio forwarding
    if (!('AudioContext' in window) || !('mediaDevices' in navigator)) {
        alert('Your browser does not fully support audio forwarding features. Some features may not work.');
    }
    
    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    // Configure Speech Recognition
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US'; // Default language
    
    // Initialize Speech Synthesis
    const synth = window.speechSynthesis;
    let selectedVoice = null;
    
    // Audio context for output routing and recording
    let audioContext = null;
    let audioDestination = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;
    
    // Initialize audio context when needed
    function initAudioContext() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('Audio context initialized');
                
                // Create a media stream destination for recording
                audioDestination = audioContext.createMediaStreamDestination();
            } catch (error) {
                console.error('Failed to initialize audio context:', error);
                alert('Failed to initialize audio forwarding. Your browser may not support this feature.');
            }
        }
    }
    
    // Function to get available audio output devices
    async function getAudioOutputDevices() {
        try {
            // First, we need to get permission to access devices
            await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Now we can enumerate devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            const outputDevices = devices.filter(device => device.kind === 'audiooutput');
            
            // Clear existing options
            outputSelect.innerHTML = '<option value="default">Default Output Device</option>';
            
            // Add devices to select
            outputDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Output ${outputSelect.options.length + 1}`;
                outputSelect.appendChild(option);
            });
            
            console.log(`Found ${outputDevices.length} audio output devices`);
            
            if (outputDevices.length === 0) {
                alert('No audio output devices found. Default device will be used.');
            }
        } catch (error) {
            console.error('Error getting audio devices:', error);
            alert('Failed to get audio devices. Check your browser permissions.');
        }
    }
    
    // Start/stop recording
    function toggleRecording(start) {
        if (start && !isRecording) {
            // Initialize audio context if not already done
            initAudioContext();
            
            // Start recording
            audioChunks = [];
            try {
                mediaRecorder = new MediaRecorder(audioDestination.stream);
                
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };
                
                mediaRecorder.onstop = () => {
                    downloadRecordingBtn.disabled = false;
                    console.log('Recording stopped');
                };
                
                mediaRecorder.start();
                isRecording = true;
                console.log('Recording started');
            } catch (error) {
                console.error('Failed to start recording:', error);
                alert('Failed to start recording. Your browser may not support this feature.');
            }
        } else if (!start && isRecording && mediaRecorder) {
            // Stop recording
            mediaRecorder.stop();
            isRecording = false;
        }
    }
    
    // Download recorded audio
    function downloadRecording() {
        if (audioChunks.length === 0) return;
        
        const blob = new Blob(audioChunks, { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'voice-conversion-' + new Date().toISOString() + '.wav';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    }
    
    // Speech parameters
    let currentPitch = parseFloat(pitchSlider.value);
    let currentRate = parseFloat(rateSlider.value);
    
    // Update displayed values for sliders
    pitchValue.textContent = currentPitch.toFixed(1);
    rateValue.textContent = currentRate.toFixed(1);
    
    // Log initial values
    console.log('Initial pitch:', currentPitch);
    console.log('Initial rate:', currentRate);
    
    // Get available voices and populate the dropdown
    function loadVoices() {
        const voices = synth.getVoices();
        
        // Clear existing options
        voiceSelect.innerHTML = '';
        
        // Score and sort voices by naturalness
        const scoredVoices = voices.map(voice => {
            let score = 0;
            
            // Prefer male voices for this application
            if (voice.name.toLowerCase().includes('male') || 
                (voice.gender && voice.gender.toLowerCase() === 'male')) {
                score += 5;
            }
            
            // Prefer natural-sounding voices
            const naturalVoiceKeywords = ['neural', 'wavenet', 'premium', 'enhanced', 'natural'];
            for (const keyword of naturalVoiceKeywords) {
                if (voice.name.toLowerCase().includes(keyword)) {
                    score += 3;
                }
            }
            
            // Prefer specific high-quality voices known to sound natural
            const highQualityVoices = [
                'Google UK English Male', 'Microsoft Guy', 'Microsoft Mark',
                'Daniel', 'Alex', 'Google US English', 'Microsoft David'
            ];
            
            for (const name of highQualityVoices) {
                if (voice.name.includes(name)) {
                    score += 2;
                }
            }
            
            return { voice, score };
        }).sort((a, b) => b.score - a.score);
        
        // Add voices to dropdown
        scoredVoices.forEach(({ voice, score }) => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            option.dataset.score = score;
            voiceSelect.appendChild(option);
        });
        
        // Select the highest-scored voice by default
        if (scoredVoices.length > 0) {
            selectedVoice = scoredVoices[0].voice;
            voiceSelect.value = selectedVoice.name;
            console.log('Selected voice:', selectedVoice.name, 'with score:', scoredVoices[0].score);
        }
    }
    
    // Load voices when they are available
    if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = loadVoices;
    } else {
        // For browsers that don't fire onvoiceschanged
        setTimeout(loadVoices, 500);
    }
    
    // Event listeners for voice controls
    voiceSelect.addEventListener('change', () => {
        const voices = synth.getVoices();
        selectedVoice = voices.find(voice => voice.name === voiceSelect.value) || voices[0];
        console.log('Voice changed to:', selectedVoice.name);
    });
    
    // Event listeners for audio output device selection
    outputSelect.addEventListener('change', () => {
        console.log('Output device changed to:', outputSelect.value);
    });
    
    // Event listener for refresh outputs button
    refreshOutputsBtn.addEventListener('click', () => {
        getAudioOutputDevices();
    });
    
    // Event listener for recording toggle
    enableRecording.addEventListener('change', () => {
        toggleRecording(enableRecording.checked);
    });
    
    // Event listener for download recording button
    downloadRecordingBtn.addEventListener('click', downloadRecording);
    
    // Event listeners for voice controls with immediate feedback
    pitchSlider.addEventListener('input', () => {
        currentPitch = parseFloat(pitchSlider.value);
        pitchValue.textContent = currentPitch.toFixed(1);
        console.log('Pitch changed to:', currentPitch);
        
        // Provide immediate audio feedback on pitch change if possible
        if (!synth.speaking && selectedVoice) {
            const testUtterance = new SpeechSynthesisUtterance('Testing pitch');
            testUtterance.voice = selectedVoice;
            testUtterance.pitch = currentPitch;
            testUtterance.rate = currentRate;
            testUtterance.volume = 0.3; // Lower volume for test
            synth.cancel(); // Cancel any previous test
            synth.speak(testUtterance);
        }
    });
    
    rateSlider.addEventListener('input', () => {
        currentRate = parseFloat(rateSlider.value);
        rateValue.textContent = currentRate.toFixed(1);
        console.log('Rate changed to:', currentRate);
    });
    
    // Function to update status display
    function updateStatus(status) {
        statusElement.textContent = status;
        statusElement.className = ''; // Reset classes
        
        switch (status) {
            case 'Listening':
                statusElement.classList.add('status-listening');
                document.body.classList.add('listening-active');
                break;
            case 'Processing':
                statusElement.classList.add('status-processing');
                document.body.classList.remove('listening-active');
                break;
            case 'Speaking':
                statusElement.classList.add('status-speaking');
                document.body.classList.remove('listening-active');
                break;
            default:
                document.body.classList.remove('listening-active');
                break;
        }
    }
    
    // Function to speak text with selected voice and forward to selected output
    function speakText(text) {
        // Don't speak if text is empty or just whitespace
        if (!text.trim()) return;
        
        // Cancel any ongoing speech
        if (synth.speaking) {
            synth.cancel();
        }
        
        updateStatus('Speaking');
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Apply voice and speech parameters
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        
        // Set properties for more natural speech - ensure they're applied correctly
        utterance.pitch = currentPitch;
        utterance.rate = currentRate;
        utterance.volume = 1; // Full volume
        
        // Log the speech parameters being used
        console.log('Speaking with:', {
            voice: selectedVoice ? selectedVoice.name : 'default',
            pitch: utterance.pitch,
            rate: utterance.rate,
            outputDevice: outputSelect.value
        });
        
        // Add some SSML-like processing for more natural pauses
        // This doesn't use actual SSML but simulates some of its effects
        const processedText = text
            .replace(/([.!?])\s+/g, '$1\n\n') // Add pauses after sentences
            .replace(/([,;:])\s+/g, '$1\n'); // Add smaller pauses after commas, etc.
            
        utterance.text = processedText;
        
        // Handle audio forwarding using the Web Audio API (if supported)
        try {
            // Initialize audio context if recording is enabled or output device is selected
            if (enableRecording.checked || outputSelect.value !== 'default') {
                initAudioContext();
            }

            // Event handlers
            utterance.onstart = (event) => {
                console.log('Speech started');
                
                // If we're using a specific output device or recording
                if ((outputSelect.value !== 'default' || enableRecording.checked) && 
                    audioContext && 'sinkId' in HTMLMediaElement.prototype) {
                    
                    // Create a MediaElementAudioSourceNode
                    // We need to do this to capture the speech synthesis audio
                    const audio = new Audio();
                    
                    // Set the output device if specified
                    if (outputSelect.value !== 'default') {
                        audio.setSinkId(outputSelect.value).catch(error => {
                            console.error('Error setting audio output device:', error);
                        });
                    }
                    
                    // Connect to the audio destination for recording if enabled
                    if (enableRecording.checked && audioDestination) {
                        const source = audioContext.createMediaElementSource(audio);
                        source.connect(audioContext.destination); // Connect to speakers
                        source.connect(audioDestination); // Connect to recording destination
                    }
                }
            };
            
            utterance.onend = () => {
                // If recognition is still running, go back to listening status
                if (recognitionActive) {
                    updateStatus('Listening');
                } else {
                    updateStatus('Idle');
                }
            };
            
            utterance.onerror = (event) => {
                console.error('SpeechSynthesis Error:', event);
                updateStatus('Error in speech synthesis');
            };
        } catch (error) {
            console.error('Error setting up audio forwarding:', error);
            // Fall back to regular speech synthesis without forwarding
        }
        
        // Speak the text
        synth.speak(utterance);
    }
    
    // Variable to track if recognition is active
    let recognitionActive = false;
    let finalTranscript = '';
    let interimTranscript = '';
    
    // Event handlers for Speech Recognition
    recognition.onstart = () => {
        recognitionActive = true;
        updateStatus('Listening');
        startBtn.disabled = true;
        stopBtn.disabled = false;
    };
    
    recognition.onend = () => {
        if (recognitionActive) {
            // If it was active but ended unexpectedly, restart it
            recognition.start();
        } else {
            updateStatus('Idle');
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
    };
    
    recognition.onresult = (event) => {
        interimTranscript = '';
        finalTranscript = '';
        
        // Process results
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Update the recognized text display
        recognizedTextElement.innerHTML = finalTranscript + 
            '<span style="color: #999;">' + interimTranscript + '</span>';
        
        // If we have a final result, speak it
        if (finalTranscript) {
            updateStatus('Processing');
            speakText(finalTranscript);
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Speech Recognition Error:', event.error);
        updateStatus('Error: ' + event.error);
        
        // If it's a fatal error, reset the recognition
        if (event.error === 'network' || event.error === 'service-not-allowed') {
            recognitionActive = false;
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
    };
    
    // Test phrases for voice testing
    const testPhrases = [
        "This is a test of the voice settings. How does it sound?",
        "Adjusting the pitch can make the voice sound higher or lower.",
        "The speed control affects how quickly the voice speaks.",
        "Testing, one, two, three. Can you hear the difference?",
        "Voice conversion is working with these settings."
    ];
    
    // Function to speak a test phrase
    function speakTestPhrase() {
        // Get a random test phrase
        const phrase = testPhrases[Math.floor(Math.random() * testPhrases.length)];
        
        updateStatus('Testing Voice');
        
        // Create a special test utterance
        const testUtterance = new SpeechSynthesisUtterance(phrase);
        
        // Apply current voice and speech parameters
        if (selectedVoice) {
            testUtterance.voice = selectedVoice;
        }
        
        // Apply pitch with browser-specific adjustments if needed
        testUtterance.pitch = currentPitch;
        testUtterance.rate = currentRate;
        testUtterance.volume = 1;
        
        // Log the test parameters
        console.log('Testing voice with:', {
            voice: selectedVoice ? selectedVoice.name : 'default',
            pitch: testUtterance.pitch,
            rate: testUtterance.rate,
            phrase: phrase,
            outputDevice: outputSelect.value
        });
        
        // Process text for more natural pauses
        const processedText = phrase
            .replace(/([.!?])\s+/g, '$1\n\n')
            .replace(/([,;:])\s+/g, '$1\n');
            
        testUtterance.text = processedText;
        
        // Try to use selected output device
        try {
            if (outputSelect.value !== 'default') {
                initAudioContext();
                
                // Similar setup as in speakText function
                testUtterance.onstart = (event) => {
                    console.log('Test speech started');
                    
                    if (audioContext && 'sinkId' in HTMLMediaElement.prototype) {
                        const audio = new Audio();
                        
                        audio.setSinkId(outputSelect.value).catch(error => {
                            console.error('Error setting audio output device for test:', error);
                        });
                        
                        if (enableRecording.checked && audioDestination) {
                            const source = audioContext.createMediaElementSource(audio);
                            source.connect(audioContext.destination);
                            source.connect(audioDestination);
                        }
                    }
                };
            }
        } catch (error) {
            console.error('Error setting up test audio forwarding:', error);
        }
        
        // Event handlers
        testUtterance.onend = () => {
            updateStatus('Idle');
        };
        
        testUtterance.onerror = (event) => {
            console.error('Test Speech Error:', event);
            updateStatus('Error in test speech');
        };
        
        // Cancel any ongoing speech and speak the test phrase
        if (synth.speaking) {
            synth.cancel();
        }
        
        synth.speak(testUtterance);
    }
    
    // Button event listeners
    startBtn.addEventListener('click', () => {
        finalTranscript = '';
        interimTranscript = '';
        recognizedTextElement.innerHTML = '';
        recognitionActive = true;
        
        try {
            recognition.start();
        } catch (error) {
            console.error('Error starting recognition:', error);
            // If already started, stop and restart
            if (error.name === 'InvalidStateError') {
                recognition.stop();
                setTimeout(() => recognition.start(), 200);
            }
        }
    });
    
    stopBtn.addEventListener('click', () => {
        recognitionActive = false;
        recognition.stop();
        updateStatus('Idle');
        startBtn.disabled = false;
        stopBtn.disabled = true;
    });
    
    // Voice preset buttons
    const deepVoiceBtn = document.getElementById('deepVoiceBtn');
    const defaultVoiceBtn = document.getElementById('defaultVoiceBtn');
    
    // Deep voice settings
    const deepVoiceSettings = {
        pitch: 0.1,  // Lowest possible pitch
        rate: 0.8,   // Slightly slower rate for deeper effect
        preferredVoices: [
            'Microsoft David', 'Google UK English Male', 'Daniel',
            'Microsoft Mark', 'Microsoft David Desktop'
        ]
    };
    
    // Default voice settings
    const defaultVoiceSettings = {
        pitch: 1.0,
        rate: 0.9
    };
    
    // Function to apply deep voice settings
    function applyDeepVoice() {
        console.log('Applying deep voice settings');
        
        // Set pitch to lowest value
        currentPitch = deepVoiceSettings.pitch;
        pitchSlider.value = currentPitch;
        pitchValue.textContent = currentPitch.toFixed(1);
        
        // Set rate to slower value
        currentRate = deepVoiceSettings.rate;
        rateSlider.value = currentRate;
        rateValue.textContent = currentRate.toFixed(1);
        
        // Try to find a deeper-sounding voice
        const voices = synth.getVoices();
        for (const preferredVoice of deepVoiceSettings.preferredVoices) {
            const voice = voices.find(v => v.name.includes(preferredVoice));
            if (voice) {
                selectedVoice = voice;
                voiceSelect.value = voice.name;
                console.log('Selected deeper voice:', voice.name);
                break;
            }
        }
        
        // Speak a test phrase with the deep voice settings
        speakTestPhrase();
    }
    
    // Function to reset to default voice settings
    function resetToDefault() {
        console.log('Resetting to default voice settings');
        
        // Reset pitch to default
        currentPitch = defaultVoiceSettings.pitch;
        pitchSlider.value = currentPitch;
        pitchValue.textContent = currentPitch.toFixed(1);
        
        // Reset rate to default
        currentRate = defaultVoiceSettings.rate;
        rateSlider.value = currentRate;
        rateValue.textContent = currentRate.toFixed(1);
        
        // Reset to the highest-scored voice
        loadVoices(); // This will re-select the best voice
        
        // Speak a test phrase with the default settings
        speakTestPhrase();
    }
    
    // Event listeners for preset buttons
    deepVoiceBtn.addEventListener('click', applyDeepVoice);
    defaultVoiceBtn.addEventListener('click', resetToDefault);
    
    // Test Voice button event listener
    const testVoiceBtn = document.getElementById('testVoiceBtn');
    testVoiceBtn.addEventListener('click', speakTestPhrase);
    
    // Initialize audio devices
    getAudioOutputDevices();
    
    // Initial status
    updateStatus('Idle');
});