const url = require('url');

const WebSocket = require('ws');
const log = new (require('log'))({ tag: 'websocket-server' });

module.exports = class WebsocketServer extends WebSocket.Server {
	constructor({ server, socketPath = '/api', ...settings }){
		super({ noServer: !!server, ...settings });

		if(!server) return log.error('[websocket-server] Requires a http server!');

		server.on('upgrade', (request, socket, head) => {
			const pathname = url.parse(request.url).pathname;

			if(pathname === socketPath){
				this.handleUpgrade(request, socket, head, (ws) => {
					this.emit('connection', ws, request);
				});
			}

			else socket.destroy();
		});

		this.on('connection', (socket) => {
			socket.reply = (type, payload) => {
				var message = JSON.stringify({ type, payload });

				log.warn(4)('[websocket-server] Send to client socket: ', message);

				if(socket.readyState === WebSocket.OPEN) socket.send(message);

				else log.error('Client not connected');
			};

			socket.on('message', (data) => {
				log(1)('[websocket-server] Client socket message: ', data);

				this.emit('raw', data, socket);

				try{
					data = JSON.parse(data);

					const { type, payload } = data;

					this.emit(type, payload, socket);
				}

				catch(err){
					log.warn('[websocket-server] Unable to parse as JSON: ', data, err);
				}
			});

			socket.on('close', (data) => {
				this.emit('client_disconnect', data, socket);
			});

			this.emit('client_connect', null, socket);
		});
	}

	broadcast(type, payload){
		if(!this.clients.size) return log.warn(1)('[websocket-server] No clients to broadcast');

		var message = JSON.stringify({ type, payload });

		log.warn(4)(`[websocket-server] Broadcast: ${message}`);

		this.clients.forEach(function eachClient(client){
			if(client.readyState === WebSocket.OPEN) client.send(message);
		});
	}

	createEndpoint(name, endpointHandler){
		const handler = (payload, socket) => {
			log(4)('[websocket-server] Endpoint handler: ', name, payload);

			var response = endpointHandler.call(socket, payload);

			if(response){
				log.warn(`[websocket-server] Auto-respond ${name} : ${response}`);

				socket.reply(name, response);
			}
		};

		log(1)('[websocket-server] Applying handler: ', name);

		this.on(name, handler);

		return { destroy: () => this.removeListener(name, handler) };
	}

	registerEndpoints(){
		var endpoints = Object.assign(...arguments);

		Object.keys(endpoints).forEach((name) => { this.createEndpoint(name, endpoints[name]); });
	}
};