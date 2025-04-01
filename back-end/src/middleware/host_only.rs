use actix_web::{
    body::{BoxBody, MessageBody},
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error,
    HttpResponse,
};
use futures_util::future::{ok, FutureExt, LocalBoxFuture, Ready};
use std::rc::Rc;

pub struct HostOnly;

impl<S: 'static, B> Transform<S, ServiceRequest> for HostOnly
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type Transform = HostOnlyMiddleware<S, B>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(HostOnlyMiddleware {
            service: Rc::new(service),
            _phantom: std::marker::PhantomData,
        })
    }
}

pub struct HostOnlyMiddleware<S, B> {
    service: Rc<S>,
    _phantom: std::marker::PhantomData<B>,
}

impl<S, B> Service<ServiceRequest> for HostOnlyMiddleware<S, B>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<BoxBody>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let is_local = req
            .connection_info()
            .realip_remote_addr().is_some_and(|ip_str| {
            ip_str == "127.0.0.1" || ip_str == "::1" || ip_str.starts_with("localhost")
        });

        if is_local {
            let fut = self.service.call(req);
            async move {
                // Map the successful response body B into BoxBody
                let res: ServiceResponse<B> = fut.await?;
                Ok(res.map_into_boxed_body()) // Map success body to BoxBody
            }
            .boxed_local()
        } else {
            log::warn!(
                "Forbidden access attempt to host-only route from non-local address: {:?} (Real IP: {:?})",
                req.peer_addr(),
                req.connection_info().realip_remote_addr()
            );
            // Error path: Create a ServiceResponse<BoxBody>
            let (http_req, _payload) = req.into_parts();
            let response = HttpResponse::Forbidden()
.json(serde_json::json!({"error": "forbidden", "message": "This resource is only accessible from the host machine."}));

            let service_resp = ServiceResponse::new(http_req, response.map_into_boxed_body()); // Body is already BoxBody

            async move { Ok(service_resp) }.boxed_local()
        }
    }
}
