
$ = (s) => document.querySelector(s);
$$ = (s) => document.querySelectorAll(s);
$$$ = (e, attrs = {}) => {
    const m = e.match(/(\w+)(?:([.#])(.+))?/);
    e = m[1];
    const ret = document.createElement(e);
    if (m[2] === '#') e.id = m[3];
    if (m[2] === '.') m[3].split('.').forEach((c) => e.classList.add(c));
    for (attrName in attrs) {
        const attrVal = attrs[attrName];
        if (attrName === 'classList') attrVal.forEach((c) => ret.classList.add(c));
        else ret.setAttribute(attrName, attrVal);
    }
    return ret;
}

const SEMITONE_EXPONENTIAL = 2**(1/12);
const BASE_FREQ = 110;
const getNoteFreq = (nbSemiTonesAboveBase) => BASE_FREQ * SEMITONE_EXPONENTIAL ** nbSemiTonesAboveBase;

PR = {
    au: new AudioContext,
    timeout: undefined,
    lastnotestarted: 0,
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

        // boucle des notes (on part de la plus haute; la note la plus basse doit être un la)
        for (let iPitch = 12*4 + 3; iPitch > 0; iPitch--) {
            const tr = $$$('tr');
            const note = iPitch-1;
            this.table.append(tr);
            const th = $$$('th');
            const noteName = noteNames[note%12];
            th.textContent = noteName.replace('is', '#');
            tr.append(th);
            /** @var {int} iAtom */
            for (let iAtom = 0; iAtom < this.music.atom * 5; iAtom++) {
                const td = $$$('td');
                tr.append(td);
                if (iAtom % 16 === 0) td.classList.add('newbar');
                if (iAtom % 4 === 0) td.classList.add('newtime');


            }
            // quand on passe la souris sur une ligne, on passe à la fréquence
            // de sa note
            tr.addEventListener('mouseover', (e) => {
                const newfreq = getNoteFreq(note);
                o.frequency.setValueAtTime(newfreq, au.currentTime);
            });

        }
        return this;
    },

    startAudio() {
        const t = Date.now();
        if (t < this.timeNextNoteAllowed) return;
        this.timeNextNoteAllowed = t + 100;
        if (this.timeout) clearTimeout(this.timeout);
        this.v.gain.setValueAtTime(0.2, this.au.currentTime);
        if (this.au.state === 'suspended') this.o.start();
        this.timeout = setTimeout(() => this.v.gain.setValueAtTime(0, this.au.currentTime), 1000);
    },

    appendTo(e) {
        e.append(this.table);
        return this;
    }
};

function main() {
    PR.init().appendTo($('#PR'));
}

document.body.addEventListener('click', (e) => {
    PR.startAudio();
});

window.addEventListener('load', main);