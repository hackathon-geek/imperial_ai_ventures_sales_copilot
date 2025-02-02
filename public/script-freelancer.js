const socket = io('/');

const peers = {};

const sendMessageToAi = (_aiWebSocket, message) => {
    console.log(`sending message to OpenAI: ${message}`);

    const createConversationEvent = {
        type: "conversation.item.create",
        item: {
            type: "message",
            role: "user",
            content: [{
                type: "input_text",
                text: message
            }]
        }
    };
    _aiWebSocket.send(JSON.stringify(createConversationEvent));
    const createResponseEvent = {
        type: "response.create",
        response: {
            modalities: ["text"],
            instructions: prompt,
        }
    }
    _aiWebSocket.send(JSON.stringify(createResponseEvent));
}
const sendInitialPrompt = (_aiWebSocket) => {
    sendMessageToAi(_aiWebSocket, prompt);
}
const sendNewTranscriptions = (_aiWebSocket, transcript) => {
    sendMessageToAi(_aiWebSocket, transcript);
}

let aiWebSocketGlobal;
let isOpenAiInitialized = false;
const createAiWebSocket = async () => {
    // console.log(`new OpenAI WebSocket requested.`);
    return new Promise((resolve, reject) => {
        const _aiWebSocket = new WebSocket(
            "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
            [
            "realtime",
            "openai-insecure-api-key." + OPENAI_API_KEY, 
            "openai-beta.realtime-v1"
            ]
        );

        _aiWebSocket.onopen = () => {
            // console.log("Connected to OpenAI server over wss.");
            resolve(_aiWebSocket);
        };

        _aiWebSocket.onmessage = (messageObj) => {
            const message = JSON.parse(messageObj.data);
            switch(message.type) {
                case "response.text.done": {
                    // console.log(`OpenAI Response: ${message.text}`)
                    const aiResponse = message.text;
                    const aiRecommendationsElement = document.getElementById('ai-recommendations');
                    aiRecommendationsElement.setHTMLUnsafe(aiResponse);
                    break;
                }
                case "response.done":
                    // Response complete, close the socket
                    _aiWebSocket.close();
                    break;
            }
        };

        _aiWebSocket.onclose = (event) => {
            // console.log("aiWebSocket connection closed:", event.code, event.reason);
        };

        _aiWebSocket.onerror = (error) => {
            console.error("aiWebSocket error:", error);
        };
    });
}

const myPeer = new Peer(undefined, {
    host: '/',
    port: 3001
});

myPeer.on('open', id => {
    const userId = id;
    console.log(`my userId: ${userId}`)
    socket.emit('join-room', ROOM_ID, userId);
});

const myVideoElement = document.createElement('video');
myVideoElement.muted = true;
const transcribedMessagesElement = document.getElementById('live-transcription');
navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    // ADD OWN VIDEO STREAM ON SCREEN
    addVideoStream(myVideoElement, stream);

    // TRANSCRIPTION
    // 1. CONVERT WEBCAM FEED INTO DESIRED FORMAT
    const audioTracks = stream.getAudioTracks();
    const audioOnlyStream = new MediaStream([audioTracks[0]]);
    const mediaRecorder = new MediaRecorder(audioOnlyStream, {mimeType: 'audio/webm'});
    
    // 2. CONNECT WITH DEEPGRAM LIVE TRANSCRIPTION ENDPOINT
    const dgSocket = new WebSocket('wss://api.deepgram.com/v1/listen', ['token', DG_API_KEY])
    
    // 3. WHEN SOCKET READY 
    // - SETUP SENDING OF (FORMATTED) WEBCAM DATA
    // - START RECORDING AUDIO THROUGH MICROPHONE
    dgSocket.onopen = () => {
        // console.log(`deepgram socket opened`);
        mediaRecorder.addEventListener('dataavailable', event => {
            // console.log(`webcam data formatted: ${event.data}`);
            dgSocket.send(event.data);
        })
        // START LISTENING TO MIC
        // AUDIO CHUNKED AT 1000ms
        mediaRecorder.start(1000);

        createAiWebSocket().then((_aiWebSocket) => {
            aiWebSocketGlobal = _aiWebSocket;
            sendInitialPrompt(_aiWebSocket);
        });
    }

    // ON RECEIVING TRANSCRIPTS FROM DEEPGRAM
    dgSocket.onmessage = (message) => {
        const received = JSON.parse(message.data);
        const transcript = received.channel.alternatives[0].transcript;
        // console.log(transcript);
        if (transcript == '') return;
        console.log(`TRANSCRIPT: ${transcript}`);
        if (aiWebSocketGlobal == undefined || aiWebSocketGlobal.readyState != WebSocket.OPEN) {
            createAiWebSocket().then((_aiWebSocket) => {
                aiWebSocketGlobal = _aiWebSocket;
                sendNewTranscriptions(_aiWebSocket, transcript)
            });
        } else {
            sendNewTranscriptions(aiWebSocketGlobal, transcript)
        }
    }

    socket.on('user-joined', existingPeers => {
        // console.log(existingPeers);
        if (existingPeers === null) {
            console.log('NEW ROOM INITIALIZED');
        } else if (existingPeers && existingPeers.length == 0) {
            console.log('EMPTY ROOM');
        } else {
            console.log(`USERS IN THIS ROOM: ${existingPeers}`);
            existingPeers.forEach(userId => {
                connectToNewUser(userId, stream)
            });
        }
    });

    // WHEN OWN PEER CALLED, RESPOND WITH OUR STREAM
    myPeer.on('call', callObj => {
        callObj.answer(stream);
    })

    // WHEN NEW USER JOINS:
    // - SEND THEM OUR STREAM
    // - ADD THEIR STREAM TO UI
    socket.on('user-connected', (userId) => {
        console.log(`NEW USER JOINED: ${userId}`);
        connectToNewUser(userId, stream);
    });
});

// WHEN EXISTING USER LEAVES
// CLOSE CONNECTION
socket.on('user-disconnected', userId => {
    console.log(`USER DISCONNECTED: ${userId}`);
    if (peers[userId]) peers[userId].close();
});

const freelancerVideoGridElement = document.getElementById('freelancer-video')
const addVideoStream =  (videoElement, stream) => {
    videoElement.srcObject = stream;
    videoElement.addEventListener('loadedmetadata', () => {
        videoElement.play();
    })
    freelancerVideoGridElement.append(videoElement);
}

const clientVideoGridElement = document.getElementById('client-video')
const addClientVideoStream =  (videoElement, stream) => {
    videoElement.srcObject = stream;
    videoElement.addEventListener('loadedmetadata', () => {
        videoElement.play();
    })
    clientVideoGridElement.append(videoElement);
}

const connectToNewUser = (userId, stream) => {
    // SEND OUR STREAM
    const callObj = myPeer.call(userId, stream);
    peers[userId] = callObj;
    // console.log(peers);
    
    // ADD THEIR STREAM TO OUR UI
    const videoElement = document.createElement('video');
    callObj.on('stream', userVideoStream => {
        addClientVideoStream(videoElement, userVideoStream)
    })

    // WHEN USER LEAVES, REMOVE THEIR STREAM
    callObj.on('close', () => {
        videoElement.remove()
    })
}