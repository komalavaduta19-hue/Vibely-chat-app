const SOCKET_URL = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:8000'
    : 'https://vibely-backend-5yxv.onrender.com';

const socket = (typeof io === 'function')
    ? io(SOCKET_URL, { autoConnect: false })
    : { emit() { }, on() { }, connect() { } };

const form = document.getElementById("send-cont")
const input = document.querySelector(".inputbox")
const msgCont = document.querySelector(".msgcont")
const audio = new Audio("ting.wav")

const typing = document.createElement("div")
typing.classList.add("msg", "left", "typing")

let typingTimer = null
let isTyping = false
let unseenList = []
let namee = ""
let HISTORY_KEY = ""
let history = []
let joined = false

const getTime = () =>
    new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

const writeHistory = () => {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch (err) {
        console.log("History could not be saved", err)
    }
}

const saveMessage = (msgObj) => {
    history.push(msgObj)
    if (history.length > 200) history = history.slice(-200)
    writeHistory()
}

const append = (msg, position, id, time, silent = false) => {
    const msgElem = document.createElement("div")
    msgElem.innerText = msg
    msgElem.classList.add("msg", position)
    if (id) msgElem.dataset.id = id

    const timee = document.createElement("div")
    timee.classList.add("time")

    const timeText = document.createElement("span")
    timeText.innerText = time || getTime()
    timee.append(timeText)

    if (position === 'right' && id) {
        const status = document.createElement("span")
        status.classList.add("status")
        status.dataset.level = 0
        status.innerText = "🕓"
        timee.append(status)
    }

    msgElem.append(timee)
    msgCont.append(msgElem)

    if (position === "left" && !silent) {
        audio.play().catch(() => { })
    }

    if (typing.isConnected) msgCont.append(typing)
    msgCont.scrollTop = msgCont.scrollHeight
}

const updateStatus = (id, level) => {
    const msgElem = document.querySelector(`[data-id="${id}"]`)
    if (!msgElem) return
    const status = msgElem.querySelector(".status")
    if (!status) return
    if (level <= Number(status.dataset.level)) return

    status.dataset.level = level

    if (level === 1) {
        status.innerText = "🕓"
    } else if (level === 2) {
        status.innerText = "🚀"
    } else if (level === 3) {
        status.innerText = "👀"
        status.classList.add("seen")
    }

    const saved = history.find(m => m.id === id)
    if (saved) {
        saved.level = level
        writeHistory()
    }
}

const loadHistory = () => {
    try {
        const saved = localStorage.getItem(HISTORY_KEY)
        if (!saved) return
        history = JSON.parse(saved)
        history.forEach(m => {
            append(m.text, m.position, m.id, m.time, true)
            if (m.level) updateStatus(m.id, m.level)
        })
    } catch (err) {
        console.log("History not loaded", err)
        history = []
    }
}

const isTabActive = () =>
    document.visibilityState === "visible" && document.hasFocus()

const flushSeen = () => {
    if (!isTabActive()) return
    unseenList.forEach(item => {
        socket.emit('seen', { id: item.id, senderId: item.senderId })
    })
    unseenList = []
}

form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (!joined) return
    const message = input.value.trim()
    if (!message) return

    const id = crypto.randomUUID()
    const tym = getTime()
    const text = `You : ${message}`

    append(text, 'right', id, tym)
    saveMessage({ id, text, position: 'right', time: tym, level: 0 })

    socket.emit('send', { id, message }, () => {
        updateStatus(id, 1)
    })

    input.value = ''

    clearTimeout(typingTimer)
    if (isTyping) socket.emit('stop-type')
    isTyping = false
})

input.addEventListener('input', () => {
    if (!joined) return

    if (input.value.trim() === "") {
        clearTimeout(typingTimer)
        if (isTyping) socket.emit('stop-type')
        isTyping = false
        return
    }

    if (!isTyping) {
        socket.emit('type')
        isTyping = true
    }
    clearTimeout(typingTimer)
    typingTimer = setTimeout(() => {
        socket.emit('stop-type')
        isTyping = false
    }, 500)
})

socket.on('user-joined', name => {
    append(`${name} joined the chat`, 'left')
})

socket.on('receive', data => {
    const tym = getTime()
    const text = `${data.namee} : ${data.message}`

    append(text, 'left', data.id, tym)
    saveMessage({ id: data.id, text, position: 'left', time: tym, level: 0 })

    socket.emit('delivered', { id: data.id, senderId: data.senderId })

    if (isTabActive()) {
        socket.emit('seen', { id: data.id, senderId: data.senderId })
    } else {
        unseenList.push({ id: data.id, senderId: data.senderId })
    }
})

socket.on('left', msg => {
    if (!msg || msg === "null") return
    append(`${msg} left the chat`, 'left')
})

socket.on('typing', msg => {
    typing.innerText = `${msg} is typing...`
    msgCont.append(typing)
    msgCont.scrollTop = msgCont.scrollHeight
})

socket.on('stop-typing', () => {
    typing.remove()
})

socket.on('message-delivered', id => updateStatus(id, 2))
socket.on('message-seen', id => updateStatus(id, 3))

document.addEventListener('visibilitychange', flushSeen)
window.addEventListener('focus', flushSeen)

const overlay = document.getElementById("join-overlay")
const joinForm = document.getElementById("join-form")
const joinInput = document.getElementById("join-name")

joinInput.value = ""
joinInput.focus()

joinForm.addEventListener("submit", (e) => {
    e.preventDefault()
    const name = joinInput.value.trim()
    if (!name || joined) return

    joined = true
    namee = name
    HISTORY_KEY = "chat-history-" + name

    socket.connect()
    socket.emit("new-user-joined", name)
    loadHistory()

    joinInput.value = ""
    overlay.remove()
    input.focus()
})