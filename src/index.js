const url = require('url');

const WebSocket = require('ws');
const log = require('log');

module.exports = class WebsocketServer extends WebSocket.Server {
	constructor({ server, socketPath = '/api', ...settings }){
		super({ noServer: !!server, ...settings });

		if(!server) return log.error('[websocket-server] requires a http server!');

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

				log.warn(1)('[websocket-server] send to client socket: ', message);

				if(socket.readyState === WebSocket.OPEN) socket.send(message);

				else log.error('Client not connected');
			};

			socket.on('message', (data) => {
				log(1)('[websocket-server] client socket message: ', data);

				try{ data = JSON.parse(data); }

				catch(e){
					log.error('[websocket-server]', data);

					throw e;
				}

				const { type, payload } = data;

				this.emit(type, payload, socket);
			});

			socket.on('close', (data) => {
				this.emit('client_disconnect', data, socket);
			});

			this.emit('client_connect', null, socket);
		});
	}

	broadcast(type, payload){
		if(!this.clients.size) return log.warn(1)('[websocket-server] no clients to broadcast');

		var message = JSON.stringify({ type, payload });

		log.warn(2)(`[websocket-server] broadcast: ${message}`);

		this.clients.forEach(function eachClient(client){
			if(client.readyState === WebSocket.OPEN) client.send(message);
		});
	}

	createEndpoint(name, endpointHandler){
		const handler = (payload, socket) => {
			log(1)('[websocket-server] endpoint handler: ', name, payload);

			var response = endpointHandler.call(socket, payload);

			if(response){
				log.warn(`[websocket-server] auto-respond ${name} : ${response}`);

				socket.reply(name, response);
			}
		};

		log(1)('[websocket-server] applying handler: ', name);

		this.on(name, handler);

		return { destroy: () => this.removeListener(name, handler) };
	}

	registerEndpoints(){
		var endpoints = Object.assign(...arguments);

		Object.keys(endpoints).forEach((name) => { this.createEndpoint(name, endpoints[name]); });
	}
};