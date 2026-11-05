const PORT = process.env.PORT || 8000

const io = require('socket.io')(PORT, {
    cors: {
        origin: [
            "http://localhost:3000",
            "https://YOUR-SITE.netlify.app"
        ],
        methods: ["GET", "POST"]
    }
})

const users = {}

io.on('connection', socket => {

    socket.on('new-user-joined', name => {
        if (!name || typeof name !== "string") return
        users[socket.id] = name
        socket.broadcast.emit('user-joined', name)
    })

    socket.on('send', ({ id, message }, callback) => {
        if (!users[socket.id]) return          // join kiye bina send nahi

        socket.broadcast.emit('receive', {
            id: id,
            message: message,
            namee: users[socket.id],
            senderId: socket.id
        })

        if (typeof callback === "function") callback()
    })

    socket.on('delivered', ({ id, senderId }) => {
        io.to(senderId).emit('message-delivered', id)
    })

    socket.on('seen', ({ id, senderId }) => {
        io.to(senderId).emit('message-seen', id)
    })

    socket.on('type', () => {
        if (!users[socket.id]) return
        socket.broadcast.emit('typing', users[socket.id])
    })

    socket.on('stop-type', () => {
        socket.broadcast.emit('stop-typing')
    })

    socket.on('disconnect', () => {
        const name = users[socket.id]
        if (!name) return                      // naam nahi tha to "left" mat bhejo
        socket.broadcast.emit('left', name)
        delete users[socket.id]
    })
})