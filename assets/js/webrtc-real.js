// WEBRTC REAL PARA EXCLUSIVE WALLET - NADA SIMULADO
class WebRTCRealSystem {
  constructor() {
    this.peerConnections = new Map();
    this.dataChannels = new Map();
    this.localStream = null;
    this.socket = null;
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' }
      ],
      sdpSemantics: 'unified-plan'
    };
    
    // Configurar eventos personalizados
    this.setupEventListeners();
  }

  // INICIALIZAÇÃO AUTOMÁTICA
  async initialize() {
    try {
      // Conectar ao servidor de sinalização
      this.socket = io('wss://exclusive-wallet-signaling.glitch.me', {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.setupSocketEvents();
      console.log('✅ WebRTC Real System Initialized');
      return true;
    } catch (error) {
      console.error('❌ WebRTC Initialization Error:', error);
      return false;
    }
  }

  // CONFIGURAR EVENTOS DO SOCKET
  setupSocketEvents() {
    this.socket.on('connect', () => {
      console.log('🔗 Connected to signaling server');
      this.socket.emit('register', {
        wallet: window.currentWallet?.address || 'anonymous',
        type: 'polygon-wallet'
      });
    });

    this.socket.on('users', (users) => {
      this.updateOnlineUsers(users);
    });

    this.socket.on('offer', async (data) => {
      await this.handleOffer(data.from, data.offer);
    });

    this.socket.on('answer', async (data) => {
      await this.handleAnswer(data.from, data.answer);
    });

    this.socket.on('ice-candidate', async (data) => {
      await this.handleIceCandidate(data.from, data.candidate);
    });

    this.socket.on('chat-message', (data) => {
      this.displayRealMessage(data.from, data.message, false);
    });

    this.socket.on('video-request', (data) => {
      this.handleVideoRequest(data.from);
    });

    this.socket.on('group-invite', (data) => {
      this.handleGroupInvite(data.from, data.groupId);
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from signaling server');
    });
  }

  // ATUALIZAR LISTA DE USUÁRIOS ONLINE
  updateOnlineUsers(users) {
    const onlineList = document.getElementById('onlineUsersList');
    if (!onlineList) return;

    onlineList.innerHTML = '';
    users.forEach(user => {
      if (user.id === this.socket.id) return;
      
      const userElement = document.createElement('div');
      userElement.className = 'contact-item';
      userElement.innerHTML = `
        <div class="contact-info">
          <i class="fas fa-user-circle" style="color: var(--primary-color);"></i>
          <div>
            <div style="font-weight: 500;">${user.wallet?.substring(0, 10)}...</div>
            <div style="font-size: 11px; color: var(--text-secondary);">Online</div>
          </div>
        </div>
        <div class="contact-actions">
          <button class="btn btn-secondary btn-small" onclick="window.webrtcSystem.startChat('${user.id}')">
            <i class="fas fa-comment"></i>
          </button>
          <button class="btn btn-secondary btn-small" onclick="window.webrtcSystem.requestVideo('${user.id}')">
            <i class="fas fa-video"></i>
          </button>
        </div>
      `;
      onlineList.appendChild(userElement);
    });
  }

  // CRIAR CONEXÃO P2P
  async createPeerConnection(peerId, isInitiator = false) {
    const pc = new RTCPeerConnection(this.config);
    this.peerConnections.set(peerId, pc);

    // Eventos ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          to: peerId,
          candidate: event.candidate
        });
      }
    };

    // Evento de conexão estabelecida
    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        this.onPeerConnected(peerId);
      }
    };

    // Evento de canal de dados
    if (isInitiator) {
      const dc = pc.createDataChannel('polygon-chat', {
        ordered: true,
        maxRetransmits: 3
      });
      this.setupDataChannel(peerId, dc);
    } else {
      pc.ondatachannel = (event) => {
        this.setupDataChannel(peerId, event.channel);
      };
    }

    // Adicionar stream local se disponível
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    return pc;
  }

  // INICIAR CHAT REAL
  async startChat(peerId) {
    try {
      const pc = await this.createPeerConnection(peerId, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      this.socket.emit('offer', {
        to: peerId,
        offer: offer
      });
      
      return true;
    } catch (error) {
      console.error('Error starting chat:', error);
      return false;
    }
  }

  // LIDAR COM OFERTA RECEBIDA
  async handleOffer(peerId, offer) {
    try {
      const pc = await this.createPeerConnection(peerId, false);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      this.socket.emit('answer', {
        to: peerId,
        answer: answer
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  // LIDAR COM RESPOSTA
  async handleAnswer(peerId, answer) {
    const pc = this.peerConnections.get(peerId);
    if (!pc) return;
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  // LIDAR COM CANDIDATO ICE
  async handleIceCandidate(peerId, candidate) {
    const pc = this.peerConnections.get(peerId);
    if (!pc || !candidate) return;
    
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  // CONFIGURAR CANAL DE DADOS
  setupDataChannel(peerId, dc) {
    this.dataChannels.set(peerId, dc);

    dc.onopen = () => {
      console.log(`📡 Data channel with ${peerId} is open`);
      this.displaySystemMessage(`Conexão P2P estabelecida com ${peerId.substring(0, 8)}...`);
    };

    dc.onclose = () => {
      console.log(`📡 Data channel with ${peerId} closed`);
      this.dataChannels.delete(peerId);
    };

    dc.onmessage = (event) => {
      this.handleDataMessage(peerId, event.data);
    };
  }

  // ENVIAR MENSAGEM REAL VIA WEBRTC
  sendMessage(peerId, message) {
    const dc = this.dataChannels.get(peerId);
    if (!dc || dc.readyState !== 'open') {
      // Fallback para socket se WebRTC não estiver pronto
      this.socket.emit('chat-message', {
        to: peerId,
        message: message
      });
      return false;
    }

    const messageData = {
      type: 'chat',
      text: message,
      timestamp: Date.now(),
      sender: window.currentWallet?.address || 'unknown',
      signature: this.generateSignature(message)
    };

    dc.send(JSON.stringify(messageData));
    
    // Mostrar na interface
    this.displayRealMessage('Você', message, true);
    
    return true;
  }

  // LIDAR COM MENSAGEM RECEBIDA
  handleDataMessage(peerId, rawData) {
    try {
      const data = JSON.parse(rawData);
      
      if (data.type === 'chat') {
        this.displayRealMessage(
          data.sender?.substring(0, 10) || 'Unknown',
          data.text,
          false
        );
      } else if (data.type === 'file') {
        this.handleFileTransfer(peerId, data);
      } else if (data.type === 'video-request') {
        this.handleVideoCallRequest(peerId);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  // MOSTRAR MENSAGEM NA INTERFACE
  displayRealMessage(sender, text, isSelf = false) {
    const messagesContainer = document.getElementById('privateChatMessages');
    if (!messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSelf ? 'message-sent' : 'message-received'}`;
    messageElement.innerHTML = `
      <div class="message-sender">${sender}</div>
      <div>${text}</div>
      <div class="message-time">${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</div>
    `;
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // MENSAGEM DO SISTEMA
  displaySystemMessage(text) {
    const messagesContainer = document.getElementById('privateChatMessages');
    if (!messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = 'message message-received';
    messageElement.style.background = 'rgba(212, 175, 55, 0.1)';
    messageElement.innerHTML = `
      <div class="message-sender">Sistema</div>
      <div>${text}</div>
      <div class="message-time">${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</div>
    `;
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // INICIAR CHAMADA DE VÍDEO REAL
  async startVideoCall(peerId) {
    try {
      // Solicitar permissões de mídia
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Criar conexão P2P
      const pc = await this.createPeerConnection(peerId, true);
      
      // Adicionar stream local
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });

      // Configurar vídeo local
      const localVideo = document.getElementById('localVideo');
      if (localVideo) {
        localVideo.srcObject = this.localStream;
      }

      // Enviar oferta
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });
      
      await pc.setLocalDescription(offer);
      
      this.socket.emit('video-offer', {
        to: peerId,
        offer: offer
      });

      return true;
    } catch (error) {
      console.error('Error starting video call:', error);
      return false;
    }
  }

  // LIDAR COM SOLICITAÇÃO DE VÍDEO
  async handleVideoRequest(peerId) {
    const accept = confirm(`${peerId.substring(0, 8)}... está solicitando uma chamada de vídeo. Aceitar?`);
    
    if (accept) {
      await this.startVideoCall(peerId);
    } else {
      this.socket.emit('video-reject', { to: peerId });
    }
  }

  // CONFIGURAR EVENT LISTENERS
  setupEventListeners() {
    // Quando usuário clica em "Iniciar Vídeo" na sua interface
    document.addEventListener('start-video-call', (event) => {
      const peerId = event.detail.peerId;
      this.startVideoCall(peerId);
    });

    // Quando usuário envia mensagem no chat
    document.addEventListener('send-chat-message', (event) => {
      const { peerId, message } = event.detail;
      this.sendMessage(peerId, message);
    });
  }

  // QUANDO PEER CONECTA
  onPeerConnected(peerId) {
    console.log(`✅ Peer ${peerId} connected via WebRTC`);
    this.displaySystemMessage(`Conexão P2P direta estabelecida com ${peerId.substring(0, 8)}...`);
  }

  // GERAR ASSINATURA (simplificada)
  generateSignature(message) {
    return btoa(message).substring(0, 32);
  }

  // SOLICITAR VÍDEO
  requestVideo(peerId) {
    this.socket.emit('video-request', { to: peerId });
  }

  // CHAT EM GRUPO
  async createGroupChat(memberIds) {
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Conectar com cada membro
    const connections = await Promise.all(
      memberIds.map(id => this.createPeerConnection(id, true))
    );
    
    this.socket.emit('create-group', {
      groupId: groupId,
      members: memberIds
    });
    
    return groupId;
  }

  // ENVIAR MENSAGEM PARA GRUPO
  sendGroupMessage(groupId, message) {
    const messageData = {
      type: 'group-chat',
      groupId: groupId,
      text: message,
      timestamp: Date.now(),
      sender: window.currentWallet?.address || 'unknown'
    };
    
    // Enviar para cada membro via WebRTC ou socket
    this.dataChannels.forEach((dc, peerId) => {
      if (dc.readyState === 'open') {
        dc.send(JSON.stringify(messageData));
      }
    });
    
    // Mostrar na interface
    this.displayRealMessage('Você (Grupo)', message, true);
  }

  // ENCERRAR CHAMADA
  endCall(peerId) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    
    const dc = this.dataChannels.get(peerId);
    if (dc) {
      dc.close();
      this.dataChannels.delete(peerId);
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    this.displaySystemMessage(`Chamada com ${peerId.substring(0, 8)}... encerrada`);
  }

  // LIMPAR TUDO
  cleanup() {
    this.peerConnections.forEach(pc => pc.close());
    this.dataChannels.forEach(dc => dc.close());
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    
    if (this.socket) {
      this.socket.disconnect();
    }
    
    this.peerConnections.clear();
    this.dataChannels.clear();
  }
}

// EXPORTAR PARA USO GLOBAL
window.WebRTCRealSystem = WebRTCRealSystem;

// INICIALIZAÇÃO AUTOMÁTICA QUANDO O DOCUMENTO CARREGA
document.addEventListener('DOMContentLoaded', () => {
  window.webrtcSystem = new WebRTCRealSystem();
  
  // Inicializar quando wallet conectar
  if (window.currentWallet) {
    window.webrtcSystem.initialize();
  }
  
  // Hook nos botões existentes da sua interface
  const originalStartVideo = window.startVideoCall;
  window.startVideoCall = function() {
    const videoSelect = document.getElementById('selectVideoContact');
    const peerId = videoSelect?.value;
    
    if (peerId && window.webrtcSystem) {
      window.webrtcSystem.startVideoCall(peerId);
    } else {
      // Fallback para função original
      if (originalStartVideo) originalStartVideo();
    }
  };
  
  const originalSendPrivateMessage = window.sendPrivateMessage;
  window.sendPrivateMessage = function() {
    const input = document.getElementById('privateChatInput');
    const message = input?.value;
    const peerSelect = document.getElementById('selectChatContact');
    const peerId = peerSelect?.value;
    
    if (message && peerId && window.webrtcSystem) {
      window.webrtcSystem.sendMessage(peerId, message);
      input.value = '';
    } else {
      // Fallback para função original
      if (originalSendPrivateMessage) originalSendPrivateMessage();
    }
  };
  
  console.log('🎯 WebRTC Real System loaded and integrated');
});
