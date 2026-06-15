function getISTDate() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function getISTTime() {
    const s = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const d = new Date(s);
    return { hour: d.getHours(), minute: d.getMinutes() };
}

module.exports = { getISTDate, getISTTime };
