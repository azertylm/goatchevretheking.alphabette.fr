/**
 * @file pastureAudio.ts
 * Sons du pâturage — 100 % Web Audio API (aucun fichier externe, aucun réseau).
 *
 * - Cloche alpine résonnante (partiels sinusoïdaux à décroissance exponentielle).
 * - Bêlement caprin : sawtooth + vibrato LFO (~14 Hz) + bandpass « formant ».
 * - Retours contextuels du jeu : rebond de carte, sifflet d'arbitre, clochette
 *   royale du GOAT ultime, carillon de discipline.
 *
 * L'AudioContext est créé paresseusement au premier geste utilisateur (politique
 * d'autoplay des navigateurs) : aucun son ne peut partir avant un clic/toucher.
 */

export type BleatPitch = 'royale' | 'chevreau';

/** Deux sons identiques trop rapprochés sont ignorés (anti-saturation). */
const MIN_INTERVAL_MS = 110;

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

/**
 * Gestionnaire audio (singleton).
 */
class PastureAudio {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private lastPlayed: Record<string, number> = {};

  /** Coupe ou réactive tous les sons (préférence utilisateur). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Crée (une fois) et réveille l'AudioContext ; null si l'API n'existe pas. */
  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const scope = window as Window & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext ?? scope.webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  /** Vrai si le son peut être joué (actif et non répété trop vite). */
  private allowed(key: string): boolean {
    if (!this.enabled) return false;
    const previous = this.lastPlayed[key];
    const stamp = now();
    if (previous !== undefined && stamp - previous < MIN_INTERVAL_MS) return false;
    this.lastPlayed[key] = stamp;
    return true;
  }

  /**
   * Frappe de cloche (partiels inharmoniques 1 / 2.02 / 2.9).
   * @param freq Fréquence fondamentale
   * @param delay Décalage en secondes par rapport à maintenant
   * @param gain Gain global de la frappe
   */
  private strike(freq: number, delay: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const t0 = ctx.currentTime + 0.01 + delay;
    const bus = ctx.createGain();
    bus.gain.value = gain;
    bus.connect(ctx.destination);

    // Une cloche réelle n'est pas harmonique : ces ratios imitent son timbre grave.
    const partials = [
      { ratio: 1, gain: 0.5, decay: 3.4 },
      { ratio: 2.02, gain: 0.16, decay: 1.9 },
      { ratio: 2.9, gain: 0.07, decay: 1.2 },
    ];

    for (const { ratio, gain: partialGain, decay } of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * ratio;

      const env = ctx.createGain();
      env.gain.setValueAtTime(partialGain, t0);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);

      osc.connect(env);
      env.connect(bus);
      osc.start(t0);
      osc.stop(t0 + decay + 0.05);
    }
  }

  /**
   * Cloche alpine résonnante : synthèse additive de partiels inharmoniques
   * (ratio 1 / 2.02 / 2.9) avec décroissance exponentielle du gain.
   */
  playBell(freq: number = 660): void {
    if (!this.allowed('bell')) return;
    if (!this.ensureContext()) return;
    this.strike(freq, 0, 0.75);
  }

  /**
   * Clochette royale : deux frappes (fondamentale puis quinte), jouée quand un
   * joueur est intronisé sur la case du GOAT ultime.
   */
  playRoyalChime(): void {
    if (!this.allowed('royal')) return;
    if (!this.ensureContext()) return;
    this.strike(660, 0, 0.7);
    this.strike(990, 0.13, 0.5);
    this.strike(1320, 0.27, 0.28);
  }

  /**
   * Rebond de carte : « poc » grave (sinus qui plonge) doublé d'un clic de
   * bruit filtré. Très court (~130 ms).
   */
  playBounce(): void {
    if (!this.allowed('bounce')) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t0 = ctx.currentTime + 0.01;

    // Corps grave : 240 Hz → 70 Hz, décroissance rapide.
    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(240, t0);
    thump.frequency.exponentialRampToValueAtTime(70, t0 + 0.12);

    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.32, t0);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);

    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start(t0);
    thump.stop(t0 + 0.16);

    // Clic d'attaque : court éclat de bruit filtré (le « tac » du carton posé).
    const frames = Math.max(1, Math.floor(ctx.sampleRate * 0.04));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / frames);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.16, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t0);
  }

  /**
   * Sifflet d'arbitre court : oscillateur triangulaire perché (~2,4 kHz) avec
   * trille rapide (vibrato FM ~36 Hz) et filtre bandpass, façon sifflet à bille.
   */
  playWhistle(): void {
    if (!this.allowed('whistle')) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const t0 = ctx.currentTime + 0.01;
    const duration = 0.34;
    const base = 2380;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(base, t0);
    osc.frequency.linearRampToValueAtTime(base * 1.03, t0 + duration * 0.7);
    osc.frequency.linearRampToValueAtTime(base * 0.97, t0 + duration);

    // Trille du sifflet à bille : vibrato très rapide et peu profond.
    const trill = ctx.createOscillator();
    trill.type = 'sine';
    trill.frequency.value = 36;
    const trillDepth = ctx.createGain();
    trillDepth.gain.value = base * 0.045;
    trill.connect(trillDepth);
    trillDepth.connect(osc.frequency);

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = base;
    band.Q.value = 7;

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(0.19, t0 + 0.03);
    amp.gain.setValueAtTime(0.19, t0 + duration * 0.72);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(band);
    band.connect(amp);
    amp.connect(ctx.destination);

    osc.start(t0);
    trill.start(t0);
    const end = t0 + duration + 0.05;
    osc.stop(end);
    trill.stop(end);
  }

  /**
   * Bêlement synthétique : porteur sawtooth, vibrato LFO ~14 Hz (FM),
   * mordant d'amplitude (~6 Hz) et filtre bandpass imitant les formants caprins.
   * Déclenche une vibration haptique sur mobile si disponible.
   */
  playBleat(pitch: BleatPitch = 'royale'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const royal = pitch === 'royale';
    const t0 = ctx.currentTime + 0.02;
    const dur = royal ? 1.15 : 0.8;
    const base = royal ? 190 : 390;
    const formant = royal ? 680 : 1150;

    // Porteur : départ légèrement plus aigu, puis stabilisation (accent du bêlement).
    const carrier = ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(base * 1.18, t0);
    carrier.frequency.exponentialRampToValueAtTime(base, t0 + 0.25);

    // Vibrato : LFO ~14 Hz + la droite sur la fréquence du porteur (FM légère).
    const vibrato = ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.value = royal ? 13.5 : 15;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.value = base * (royal ? 0.12 : 0.18);
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(carrier.frequency);

    // Formant « bouche de chèvre » : bandpass étroit sur les harmoniques vocales.
    const formantFilter = ctx.createBiquadFilter();
    formantFilter.type = 'bandpass';
    formantFilter.frequency.value = formant;
    formantFilter.Q.value = 6.5;

    // Enveloppe + mordant d'amplitude (bah-ê-ê-ê).
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(0.34, t0 + 0.09);
    amp.gain.setValueAtTime(0.34, t0 + dur * 0.55);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const tremolo = ctx.createOscillator();
    tremolo.type = 'sine';
    tremolo.frequency.value = royal ? 6 : 7.5;
    const tremoloDepth = ctx.createGain();
    tremoloDepth.gain.value = 0.1;
    tremolo.connect(tremoloDepth);
    tremoloDepth.connect(amp.gain);

    carrier.connect(formantFilter);
    formantFilter.connect(amp);
    amp.connect(ctx.destination);

    carrier.start(t0);
    vibrato.start(t0);
    tremolo.start(t0);
    const end = t0 + dur + 0.1;
    carrier.stop(end);
    vibrato.stop(end);
    tremolo.stop(end);

    // Retour haptique mobile, si le navigateur le permet (Android/Chrome).
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(royal ? [90, 60, 110] : 60);
    }
  }
}

/** Singleton partagé par toute l'application. */
export const pastureAudio = new PastureAudio();
