use tokio::sync::RwLock;
use std::collections::HashMap;
use std::sync::Arc;
use actix_web::Handler;
use uuid::Uuid;
use actix::{Actor, Addr, Message, Handler, StreamHandler, ActorContext, Running};
use actix_web_actors::ws;
use anyhow::Result;

// Message type for WebSocket communication
#[derive(Message)]
#[rtype(result = "()")]
pub struct WebSocketMessage(pub String);

// Actor for WebSocket sessions
pub struct WebSocketSession {
    course_id: Uuid,
    realtime_service: Arc<RealtimeService>,
}

impl WebSocketSession {
    pub fn new(course_id: Uuid, realtime_service: Arc<RealtimeService>) -> Self {
        Self {
            course_id,
            realtime_service,
        }
    }
}

impl Actor for WebSocketSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        // Register when connection is established
        let addr = ctx.address();
        self.realtime_service.register(self.course_id, addr);
    }

    fn stopping(&mut self, ctx: &mut Self::Context) -> Running {
        // Unregister when connection is closed
        let addr = ctx.address();
        self.realtime_service.unregister(self.course_id, &addr);
        Running::Stop
    }
}

// Handler for WebSocket messages
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WebSocketSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Text(text)) => {
                // Process text messages if needed
                // For now, just echo back
                ctx.text(text);
            },
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            },
            _ => (), // Ignore other message types
        }
    }
}

// Handler for custom WebSocketMessage
impl Handler<WebSocketMessage> for WebSocketSession {
    type Result = ();

    fn handle(&mut self, msg: WebSocketMessage, ctx: &mut Self::Context) {
        ctx.text(msg.0);
    }
}

/// Service for real-time updates via WebSockets
pub struct RealtimeService {
    // Clients mapped by course_id -> list of websocket sessions
    clients: RwLock<HashMap<Uuid, Vec<Addr<WebSocketSession>>>>,
}

impl RealtimeService {
    pub fn new() -> Self {
        Self {
            clients: RwLock::new(HashMap::new()),
        }
    }

    // Create a shareable instance
    pub fn into_arc(self) -> Arc<Self> {
        Arc::new(self)
    }

    // Register a new client for a course
    pub fn register(&self, course_id: Uuid, addr: Addr<WebSocketSession>) {
        tokio::spawn(async move {
            let mut clients = self.clients.write().await;
            clients.entry(course_id).or_default().push(addr);
        });
    }

    // Unregister a client
    pub fn unregister(&self, course_id: Uuid, addr: &Addr<WebSocketSession>) {
        let addr_clone = addr.clone();
        tokio::spawn(async move {
            let mut clients = self.clients.write().await;
            if let Some(course_clients) = clients.get_mut(&course_id) {
                course_clients.retain(|client_addr| client_addr != &addr_clone);
            }
        });
    }

    // Broadcast an update to all clients for a course
    pub async fn broadcast(&self, course_id: Uuid, message: &str) {
        let clients = self.clients.read().await;
        if let Some(course_clients) = clients.get(&course_id) {
            for client in course_clients {
                let _ = client.do_send(WebSocketMessage(message.to_owned()));
            }
        }
    }

    // Get count of connected clients for a course
    pub async fn get_connected_count(&self, course_id: Uuid) -> usize {
        let clients = self.clients.read().await;
        clients.get(&course_id).map_or(0, |v| v.len())
    }
}