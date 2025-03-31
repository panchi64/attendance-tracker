use actix::{Actor, AsyncContext, Running, StreamHandler, fut};
use actix_web::web;
use actix_web_actors::ws;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// Message structure for communication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketMessage(pub String);

// Simple session representation
#[derive(Debug)]
pub struct WebSocketSession {
    course_id: Uuid,
    client_id: String,
    realtime_service: Arc<RealtimeService>,
}

impl WebSocketSession {
    pub fn new(course_id: Uuid, realtime_service: Arc<RealtimeService>) -> Self {
        let client_id = Uuid::new_v4().to_string();
        Self {
            course_id,
            client_id,
            realtime_service,
        }
    }
}

// Implement Actor trait
impl Actor for WebSocketSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        // Register the client when the WebSocket connects
        let client_id = self.client_id.clone();
        let course_id = self.course_id;
        let realtime_service = self.realtime_service.clone();

        // Use a simpler approach for spawning the future
        ctx.wait(fut::wrap_future::<_, Self>(async move {
            if let Err(e) = realtime_service.register(course_id, client_id).await {
                eprintln!("Failed to register client: {}", e);
            }
        }));
    }

    fn stopping(&mut self, _: &mut Self::Context) -> Running {
        // Unregister client when the WebSocket disconnects
        let client_id = self.client_id.clone();
        let course_id = self.course_id;
        let realtime_service = self.realtime_service.clone();

        // Using tokio directly for cleanup is okay since it's during shutdown
        tokio::spawn(async move {
            if let Err(e) = realtime_service.unregister(course_id, &client_id).await {
                eprintln!("Failed to unregister client: {}", e);
            }
        });

        Running::Stop
    }
}

// Implement StreamHandler for WebSocket messages
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WebSocketSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Text(text)) => {
                // Handle text messages - you can add custom logic here
                println!("Received message: {}", text);

                // Echo back the message (or implement your custom logic)
                ctx.text(text);
            }
            Ok(ws::Message::Close(reason)) => {
                // Handle WebSocket close
                ctx.close(reason);
            }
            _ => (), // Ignore other message types
        }
    }
}

/// Service for real-time updates via WebSockets
#[derive(Debug, Clone)]
pub struct RealtimeService {
    // Clients mapped by course_id -> list of client_ids
    clients: Arc<RwLock<HashMap<Uuid, Vec<String>>>>,
}

// Keep the rest of your RealtimeService implementation...
impl RealtimeService {
    pub fn new() -> Self {
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // Create a shareable instance
    pub fn into_arc(self) -> Arc<Self> {
        Arc::new(self)
    }

    // Register a new client for a course
    pub async fn register(&self, course_id: Uuid, client_id: String) -> Result<()> {
        let mut clients = self.clients.write().await;
        clients.entry(course_id).or_default().push(client_id);
        Ok(())
    }

    // Unregister a client
    pub async fn unregister(&self, course_id: Uuid, client_id: &str) -> Result<()> {
        let mut clients = self.clients.write().await;
        if let Some(course_clients) = clients.get_mut(&course_id) {
            course_clients.retain(|id| id != client_id);
        }
        Ok(())
    }

    // Broadcast an update to all clients for a course
    pub async fn broadcast(&self, course_id: Uuid, message: &str) {
        // In a real implementation, this would send WebSocket messages to clients
        let clients = self.clients.read().await;
        if let Some(course_clients) = clients.get(&course_id) {
            println!(
                "Broadcasting to {} clients for course {}: {}",
                course_clients.len(),
                course_id,
                message
            );
            // In real implementation, you'd iterate through clients and send message
        }
    }

    // Get count of connected clients for a course
    pub async fn get_connected_count(&self, course_id: Uuid) -> usize {
        let clients = self.clients.read().await;
        clients.get(&course_id).map_or(0, |v| v.len())
    }
}

// This is now implemented as a real WebSocket handler above
// We can keep this function declaration though, as it's used in main.rs
pub async fn ws_handler(
    _req: actix_web::HttpRequest,
    _stream: web::Payload,
    _path: web::Path<String>,
    _realtime_service: web::Data<Arc<RealtimeService>>,
) -> Result<String> {
    // The actual implementation is now in the WebSocketSession Actor
    Ok("WebSocket connected".to_string())
}
