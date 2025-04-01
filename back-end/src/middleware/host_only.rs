use actix_web::{
    Error, HttpResponse,
    body::{BoxBody, MessageBody},
    dev::{Service, ServiceRequest, ServiceResponse, Transform, forward_ready},
};
use futures_util::future::{FutureExt, LocalBoxFuture, Ready, ok};
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
        let connection_info = req.connection_info().clone();
        let remote_addr = connection_info.realip_remote_addr();

        // Check if connection is from localhost
        let is_localhost = remote_addr.is_some_and(|ip_str| {
            ip_str == "127.0.0.1" || ip_str == "::1" || ip_str.starts_with("localhost")
        });

        // Allow access from localhost
        if is_localhost {
            let fut = self.service.call(req);
            async move {
                let res: ServiceResponse<B> = fut.await?;
                Ok(res.map_into_boxed_body())
            }
            .boxed_local()
        } else {
            log::warn!(
                "Forbidden access attempt to host-only route from non-local address: {:?} (Real IP: {:?})",
                req.peer_addr(),
                req.connection_info().realip_remote_addr()
            );

            let (http_req, _payload) = req.into_parts();
            let response = HttpResponse::Forbidden().json(serde_json::json!({
                "error": "forbidden",
                "message": "This administrative resource is only accessible from the host machine."
            }));

            let service_resp = ServiceResponse::new(http_req, response.map_into_boxed_body());
            async move { Ok(service_resp) }.boxed_local()
        }
    }
}
