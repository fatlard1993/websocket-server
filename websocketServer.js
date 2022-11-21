const url = require('url');

const WebSocket = require('ws');

module.exports = class WebsocketServer extends WebSocket.Server {
	static get OPEN() {
		return WebSocket.OPEN;
	}

	constructor({ server, socketPath = '/api', ...settings }) {
		super({ noServer: !!server, ...settings });

		if (server) {
			server.on('upgrade', (request, socket, head) => {
				const pathname = url.parse(request.url).pathname;

				if (pathname === socketPath) {
					this.handleUpgrade(request, socket, head, ws => {
						this.emit('connection', ws, request);
					});
				} else socket.destroy();
			});
		}

		this.on('connection', socket => {
			socket.reply = (type, payload) => {
				const message = JSON.stringify({ type, payload });

				if (socket.readyState === WebSocket.OPEN) socket.send(message);
			};

			socket.on('message', data => {
				this.emit('raw', data, socket);

				try {
					const { type, payload } = JSON.parse(data);

					this.emit(type, payload, socket);
				} catch (err) {
					console.error(err);
				}
			});

			socket.on('close', data => {
				this.emit('client_disconnect', data, socket);
			});

			this.emit('client_connect', null, socket);
		});
	}

	broadcast(type, payload) {
		if (!this.clients.size) return;

		const message = JSON.stringify({ type, payload });

		this.clients.forEach(function eachClient(client) {
			if (client.readyState === WebSocket.OPEN) client.send(message);
		});
	}

	createEndpoint(name, endpointHandler) {
		const handler = (payload, socket) => {
			const response = endpointHandler.call(socket, payload);

			if (response) {
				socket.reply(name, response);
			}
		};

		this.on(name, handler);

		return { destroy: () => this.removeListener(name, handler) };
	}

	registerEndpoints() {
		const endpoints = Object.assign(...arguments);

		Object.keys(endpoints).forEach(name => {
			this.createEndpoint(name, endpoints[name]);
		});
	}
};
