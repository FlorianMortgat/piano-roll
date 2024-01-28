
$ = (s) => document.querySelector(s);
$$ = (s) => document.querySelectorAll(s);
$$$ = (e, attrs = {}) => {
    const m = e.match(/(\w+)(?:([.#])(.+))?/);
    e = m[1];
    const ret = document.createElement(e);
    if (m[2] === '#') ret.id = m[3];
    if (m[2] === '.') m[3].split('.').forEach((c) => ret.classList.add(c));
    for (attrName in attrs) {
        const attrVal = attrs[attrName];
        if (attrName === 'classList') attrVal.forEach((c) => ret.classList.add(c));
        else ret.setAttribute(attrName, attrVal);
    }
    return ret;
}

const SEMITONE_EXPONENTIAL = 2 ** (1 / 12);
const BASE_FREQ = 110;
const getNoteFreq = (nbSemiTonesAboveBase) => BASE_FREQ * SEMITONE_EXPONENTIAL ** nbSemiTonesAboveBase;

PR = {
    running: false,
    au: new AudioContext,
    timeout: undefined,
    lastnotestarted: 0,
    currentNote: {
        pitch: 0,
        startTime: 0,
        duration: 0,
        dragging: false, // passe à true pendant que la note est en cours d'étirement (mouse button down)
    },
    tuneNotes: [],
    init() {
        const noteNames = 'a ais b c cis d dis e f fis g gis'.split(' ');
        const noteNamesFR = ['la', 'la#', 'si', 'do', 'do#', 'ré', 'ré#', 'mi', 'fa', 'fa#', 'sol', 'sol#'];
        const au = this.au;

        const o = this.o = au.createOscillator();
        const v = this.v = au.createGain();
        const p = this.p = au.createStereoPanner();
        o.type = 'sine';
        o.connect(v).connect(p).connect(this.au.destination);

        this.music = {
            atom: 16, // = la plus petite note durera 1/16 de ronde, soit une double-croche
            notes: [], // monophonique pour l'instant
        };
        this.table = $$$('table', { classList: ['pianoroll'] });
        this.table.oncontextmenu = () => false;

        // boucle des notes (on part de la plus haute; la note la plus basse doit être un la)
        for (let iPitch = 12 * 4 + 3; iPitch > 0; iPitch--) {
            const note = iPitch - 1;
            const tr = $$$(`tr#piano-key-${note}`);
            this.table.append(tr);
            const th = $$$('th');
            const noteName = noteNames[note % 12];
            th.textContent = noteName.replace('is', '#');
            tr.append(th);
            /** @var {int} iAtom */
            for (let iAtom = 0; iAtom < this.music.atom * 5; iAtom++) {
                const td = $$$('td');
                tr.append(td);
                if (iAtom % 16 === 0) td.classList.add('newbar');
                if (iAtom % 4 === 0) td.classList.add('newtime');

                td.addEventListener('mousedown', (e) => {
                    console.log(e.buttons);
                    if (e.buttons === 1) this.mbDown(td, iAtom, note);
                    if (e.buttons === 2) this.poplast();
                });
                td.addEventListener('mouseover', (e) => {
                    this.mover(td, iAtom, note)
                });
                td.addEventListener('mouseup', (e) => {
                    this.mbUp(td, iAtom, note);
                });

            }
            // quand on passe la souris sur une ligne, on passe à la fréquence
            // de sa note
            // tr.addEventListener('mouseover', (e) => o.frequency.setValueAtTime(getNoteFreq(note), au.currentTime));

        }
        return this;
    },

    refresh() {
        this.table.querySelectorAll('td').forEach(td => td.classList.remove('note'));
        this.tuneNotes.forEach((n) => this.drawNote(n));
    },

    drawNote(n) {
        const tr = $(`#piano-key-${n.pitch}`);
        const tdWithNote = Array.from(tr.childNodes).slice(n.startTime + 1, n.startTime + 1 + n.duration);
        tdWithNote.forEach(td => td.classList.add('note'));
    },

    mbDown(td, iAtom, note) {
        this.currentNote.pitch = note;
        this.currentNote.startTime = iAtom;
        this.currentNote.dragging = true;
        this.o.frequency.setValueAtTime(getNoteFreq(note), this.au.currentTime);
        this.playAudio();
        this.mover(td, iAtom, note);
    },
    mbUp(td, iAtom, note) {
        this.stopAudio();
        if (!this.currentNote.dragging) return;
        this.currentNote.dragging = false;
        this.tuneNotes.push(this.currentNote);
        this.currentNote = { pitch: 0, startTime: 0, duration: 0, dragging: false };
        this.refresh();
    },
    mover(td, iAtom, note) {
        const cn = this.currentNote;
        if (!cn.dragging) return;
        if (note !== cn.pitch) {
            this.refresh();
            this.o.frequency.setValueAtTime(getNoteFreq(note), this.au.currentTime);
        }
        if (iAtom < cn.startTime) return;
        cn.duration = iAtom + 1 - cn.startTime;
        cn.pitch = note;
        const tr = td.parentNode;
        const selectedTd = (cn.duration > 1) ? tr.querySelectorAll(`td:nth-child(n + ${cn.startTime + 2}):nth-child(-n + ${iAtom + 2})`) : tr.querySelectorAll(`td:nth-child(${cn.startTime + 2})`);
        selectedTd.forEach((_td) => _td.classList.add('note'));
    },

    poplast() {
        this.tuneNotes.pop();
        this.refresh();
    },

    runAudio() {
        //const t = Date.now();
        //if (t < this.timeNextNoteAllowed) return;
        //this.timeNextNoteAllowed = t + 100;
        if (this.au.state === 'suspended') this.o.start();
        this.running = true;
    },

    playTune() {
        const tempo = 120;
        const atomicDuration = 4/16 * (60/tempo);
        this.tuneNotes.forEach(n => {
            let starttime = this.au.currentTime + n.startTime * atomicDuration;
            let stoptime = starttime + n.duration * atomicDuration - 4/128; // pour marquer un bref arrêt
            this.v.gain.setValueAtTime(0.2, starttime);
            this.o.frequency.setValueAtTime(getNoteFreq(n.pitch), starttime);
            this.v.gain.setValueAtTime(0, stoptime);
        });
    },

    clearTune() {
        this.tuneNotes.length = 0;
        this.refresh();
    },

    playAudio() {
        if (!this.running) this.runAudio();
        this.v.gain.setValueAtTime(0.2, this.au.currentTime);
        if (this.timeout) clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.v.gain.setValueAtTime(0, this.au.currentTime), 3000);
    },

    stopAudio() {
        this.v.gain.setValueAtTime(0, this.au.currentTime);
        if (this.timeout) clearTimeout(this.timeout);
    },

    appendTo(e) {
        e.append(this.table);
        return this;
    }
};

function main() {
    PR.init().appendTo($('#PR'));
    $('#play-tune').onclick = () => PR.playTune();
    $('#clear-tune').onclick = () => PR.clearTune();
}

document.body.addEventListener('click', (e) => {
});

window.addEventListener('load', main);