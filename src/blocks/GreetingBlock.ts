import { Setting, moment } from 'obsidian';
import { BaseBlock } from './BaseBlock';
import { createEmojiPicker, EmojiPickerInstance } from '../utils/emojiPicker';
import { dailyIndex } from '../utils/dailySeed';

type EmojiMode = 'auto' | 'custom' | 'random';

interface GreetingConfig {
  name?: string;
  showTime?: boolean;
  showEmoji?: boolean;
  emojiMode?: EmojiMode;
  emojiMorning?: string;
  emojiAfternoon?: string;
  emojiEvening?: string;
  emojiNight?: string;
  emojiPool?: string;
  emojiDailySeed?: boolean;
  // Custom salutations
  salutationMode?: 'auto' | 'custom';
  salutationPreset?: string;
  salutMorning?: string;
  salutAfternoon?: string;
  salutEvening?: string;
}

// ── Language presets ────────────────────────────────────────────────────
interface LangPreset {
  label: string;
  morning: string;
  afternoon: string;
  evening: string;
}

const LANG_PRESETS: Record<string, LangPreset> = {
  it:    { label: 'Italiano',       morning: 'Buongiorno',        afternoon: 'Buon pomeriggio',  evening: 'Buonasera' },
  en:    { label: 'English',        morning: 'Good morning',      afternoon: 'Good afternoon',   evening: 'Good evening' },
  es:    { label: 'Español',        morning: 'Buenos días',       afternoon: 'Buenas tardes',    evening: 'Buenas noches' },
  fr:    { label: 'Français',       morning: 'Bonjour',           afternoon: 'Bon après-midi',   evening: 'Bonsoir' },
  de:    { label: 'Deutsch',        morning: 'Guten Morgen',      afternoon: 'Guten Tag',        evening: 'Guten Abend' },
  pt:    { label: 'Português',      morning: 'Bom dia',           afternoon: 'Boa tarde',        evening: 'Boa noite' },
  nl:    { label: 'Nederlands',     morning: 'Goedemorgen',       afternoon: 'Goedemiddag',      evening: 'Goedenavond' },
  sv:    { label: 'Svenska',        morning: 'God morgon',        afternoon: 'God eftermiddag',  evening: 'God kväll' },
  no:    { label: 'Norsk',          morning: 'God morgen',        afternoon: 'God ettermiddag',   evening: 'God kveld' },
  da:    { label: 'Dansk',          morning: 'God morgen',        afternoon: 'God eftermiddag',  evening: 'God aften' },
  fi:    { label: 'Suomi',          morning: 'Hyvää huomenta',    afternoon: 'Hyvää iltapäivää', evening: 'Hyvää iltaa' },
  pl:    { label: 'Polski',         morning: 'Dzień dobry',       afternoon: 'Dzień dobry',      evening: 'Dobry wieczór' },
  cs:    { label: 'Čeština',        morning: 'Dobré ráno',        afternoon: 'Dobré odpoledne',  evening: 'Dobrý večer' },
  sk:    { label: 'Slovenčina',     morning: 'Dobré ráno',        afternoon: 'Dobré popoludnie', evening: 'Dobrý večer' },
  hu:    { label: 'Magyar',         morning: 'Jó reggelt',        afternoon: 'Jó napot',         evening: 'Jó estét' },
  ro:    { label: 'Română',         morning: 'Bună dimineața',    afternoon: 'Bună ziua',        evening: 'Bună seara' },
  hr:    { label: 'Hrvatski',       morning: 'Dobro jutro',       afternoon: 'Dobar dan',        evening: 'Dobra večer' },
  sr:    { label: 'Srpski',         morning: 'Dobro jutro',       afternoon: 'Dobar dan',        evening: 'Dobro veče' },
  bg:    { label: 'Български',      morning: 'Добро утро',        afternoon: 'Добър ден',        evening: 'Добър вечер' },
  uk:    { label: 'Українська',     morning: 'Доброго ранку',     afternoon: 'Добрий день',      evening: 'Добрий вечір' },
  ru:    { label: 'Русский',        morning: 'Доброе утро',       afternoon: 'Добрый день',      evening: 'Добрый вечер' },
  el:    { label: 'Ελληνικά',       morning: 'Καλημέρα',          afternoon: 'Καλό απόγευμα',    evening: 'Καλησπέρα' },
  tr:    { label: 'Türkçe',         morning: 'Günaydın',          afternoon: 'Tünaydın',         evening: 'İyi akşamlar' },
  ar:    { label: 'العربية',         morning: 'صباح الخير',         afternoon: 'مساء الخير',        evening: 'مساء الخير' },
  he:    { label: 'עברית',           morning: 'בוקר טוב',          afternoon: 'צהריים טובים',     evening: 'ערב טוב' },
  fa:    { label: 'فارسی',           morning: 'صبح بخیر',           afternoon: 'عصر بخیر',          evening: 'شب بخیر' },
  hi:    { label: 'हिन्दी',           morning: 'सुप्रभात',            afternoon: 'नमस्कार',           evening: 'शुभ संध्या' },
  bn:    { label: 'বাংলা',           morning: 'সুপ্রভাত',            afternoon: 'শুভ অপরাহ্ণ',       evening: 'শুভ সন্ধ্যা' },
  ta:    { label: 'தமிழ்',           morning: 'காலை வணக்கம்',       afternoon: 'மதிய வணக்கம்',     evening: 'மாலை வணக்கம்' },
  te:    { label: 'తెలుగు',          morning: 'శుభోదయం',           afternoon: 'శుభ మధ్యాహ్నం',    evening: 'శుభ సాయంత్రం' },
  mr:    { label: 'मराठी',           morning: 'सुप्रभात',            afternoon: 'शुभ दुपार',          evening: 'शुभ संध्याकाळ' },
  gu:    { label: 'ગુજરાતી',         morning: 'સુપ્રભાત',           afternoon: 'શુભ બપોર',          evening: 'શુભ સાંજ' },
  ur:    { label: 'اردو',            morning: 'صبح بخیر',           afternoon: 'سہ پہر بخیر',       evening: 'شام بخیر' },
  th:    { label: 'ไทย',             morning: 'สวัสดีตอนเช้า',        afternoon: 'สวัสดีตอนบ่าย',      evening: 'สวัสดีตอนเย็น' },
  vi:    { label: 'Tiếng Việt',     morning: 'Chào buổi sáng',    afternoon: 'Chào buổi chiều',  evening: 'Chào buổi tối' },
  id:    { label: 'Bahasa Indonesia', morning: 'Selamat pagi',     afternoon: 'Selamat siang',    evening: 'Selamat malam' },
  ms:    { label: 'Bahasa Melayu',  morning: 'Selamat pagi',      afternoon: 'Selamat petang',   evening: 'Selamat malam' },
  tl:    { label: 'Filipino',       morning: 'Magandang umaga',   afternoon: 'Magandang hapon',  evening: 'Magandang gabi' },
  zh:    { label: '中文',             morning: '早上好',              afternoon: '下午好',             evening: '晚上好' },
  ja:    { label: '日本語',           morning: 'おはようございます',     afternoon: 'こんにちは',          evening: 'こんばんは' },
  ko:    { label: '한국어',           morning: '좋은 아침',            afternoon: '좋은 오후',           evening: '좋은 저녁' },
  sw:    { label: 'Kiswahili',      morning: 'Habari ya asubuhi', afternoon: 'Habari ya mchana', evening: 'Habari ya jioni' },
  am:    { label: 'አማርኛ',           morning: 'እንደምን አደርክ',        afternoon: 'እንደምን ዋልክ',       evening: 'እንደምን አመሸህ' },
  yo:    { label: 'Yorùbá',         morning: 'E kaaro',           afternoon: 'E kaasan',         evening: 'E kaalẹ' },
  zu:    { label: 'isiZulu',        morning: 'Sawubona ekuseni',  afternoon: 'Sawubona emini',   evening: 'Sawubona kusihlwa' },
  ha:    { label: 'Hausa',          morning: 'Ina kwana',         afternoon: 'Barka da rana',    evening: 'Barka da yamma' },
  ga:    { label: 'Gaeilge',        morning: 'Maidin mhaith',     afternoon: 'Tráthnóna maith',  evening: 'Oíche mhaith' },
  cy:    { label: 'Cymraeg',        morning: 'Bore da',           afternoon: 'Prynhawn da',      evening: 'Noswaith dda' },
  ca:    { label: 'Català',         morning: 'Bon dia',           afternoon: 'Bona tarda',       evening: 'Bona nit' },
  eu:    { label: 'Euskara',        morning: 'Egun on',           afternoon: 'Arratsalde on',    evening: 'Gabon' },
  gl:    { label: 'Galego',         morning: 'Bo día',            afternoon: 'Boa tarde',        evening: 'Boa noite' },
};

// Sorted by label for the dropdown
const PRESET_KEYS = Object.keys(LANG_PRESETS).sort((a, b) =>
  LANG_PRESETS[a].label.localeCompare(LANG_PRESETS[b].label),
);

// ── Default Italian salutations ────────────────────────────────────────
const DEFAULT_SALUT = LANG_PRESETS['it'];

const DEFAULT_EMOJIS: Record<string, string> = {
  morning: '☀️',
  afternoon: '🌤️',
  evening: '🌆',
  night: '🌙',
};

function timeSlot(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5  && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function salutSlot(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour >= 5  && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

function getSalutation(cfg: GreetingConfig, hour: number): string {
  const mode = cfg.salutationMode ?? 'auto';

  if (mode === 'custom') {
    const slot = salutSlot(hour);
    const map: Record<string, string | undefined> = {
      morning:   cfg.salutMorning,
      afternoon: cfg.salutAfternoon,
      evening:   cfg.salutEvening,
    };
    const custom = map[slot]?.trim();
    if (custom) return custom;
  }

  // auto — use preset or Italian default
  const presetKey = cfg.salutationPreset ?? 'it';
  const preset = LANG_PRESETS[presetKey] ?? DEFAULT_SALUT;
  return preset[salutSlot(hour)];
}

function pickEmoji(cfg: GreetingConfig, hour: number): string {
  const mode = cfg.emojiMode ?? 'auto';

  if (mode === 'custom') {
    const slot = timeSlot(hour);
    const map: Record<string, string | undefined> = {
      morning:   cfg.emojiMorning,
      afternoon: cfg.emojiAfternoon,
      evening:   cfg.emojiEvening,
      night:     cfg.emojiNight,
    };
    return map[slot]?.trim() || DEFAULT_EMOJIS[slot];
  }

  if (mode === 'random') {
    const pool = parseEmojiPool(cfg.emojiPool ?? '');
    if (pool.length === 0) return DEFAULT_EMOJIS[timeSlot(hour)];
    if (cfg.emojiDailySeed) {
      return pool[dailyIndex(pool.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return DEFAULT_EMOJIS[timeSlot(hour)];
}

function parseEmojiPool(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return trimmed.split(/[\s,]+/).filter(s => s.length > 0);
}

// ── Block ──────────────────────────────────────────────────────────────

export class GreetingBlock extends BaseBlock {
  private emojiEl: HTMLElement | null = null;
  private nameEl: HTMLElement | null = null;
  private timeEl: HTMLElement | null = null;

  render(el: HTMLElement): void {
    el.addClass('greeting-block');

    const cfg = this.instance.config as GreetingConfig;
    const { showTime = true, showEmoji = true } = cfg;

    if (showEmoji) {
      this.emojiEl = el.createDiv({ cls: 'greeting-emoji' });
    }
    this.nameEl = el.createDiv({ cls: 'greeting-name' });
    if (showTime) {
      this.timeEl = el.createDiv({ cls: 'greeting-time' });
    }

    this.tick();
    this.registerInterval(window.setInterval(() => this.tick(), 60_000));
  }

  private tick(): void {
    const now = moment();
    const hour = now.hour();
    const cfg = this.instance.config as GreetingConfig;
    const { name = 'bentornato', showTime = true, showEmoji = true } = cfg;

    if (this.emojiEl && showEmoji) {
      this.emojiEl.setText(pickEmoji(cfg, hour));
    }
    if (this.nameEl) {
      this.nameEl.empty();
      this.nameEl.createSpan({ cls: 'greeting-salut', text: `${getSalutation(cfg, hour)}, ` });
      this.nameEl.createSpan({ cls: 'greeting-user', text: name });
    }
    if (this.timeEl && showTime) {
      this.timeEl.setText(now.format('HH:mm'));
    }
  }

  renderContentSettings(body: HTMLElement, draft: Record<string, unknown>): void {
    const cfg = draft as GreetingConfig & Record<string, unknown>;

    // ── General ────────────────────────────────
    new Setting(body).setName('Name').addText(t =>
      t.setValue(cfg.name ?? 'bentornato')
       .onChange(v => { cfg.name = v; }),
    );
    new Setting(body).setName('Show time').addToggle(t =>
      t.setValue(cfg.showTime ?? true)
       .onChange(v => { cfg.showTime = v; }),
    );

    // ── Salutation ─────────────────────────────
    new Setting(body).setName('Salutation').setHeading();

    const salutSection = body.createDiv();
    const buildSalutSettings = () => {
      salutSection.empty();
      const mode = cfg.salutationMode ?? 'auto';

      new Setting(salutSection)
        .setName('Salutation mode')
        .setDesc('Auto: language preset. Custom: write your own for each time slot.')
        .addDropdown(d =>
          d.addOption('auto', 'Language preset')
           .addOption('custom', 'Custom text')
           .setValue(mode)
           .onChange(v => { cfg.salutationMode = v === 'custom' ? 'custom' : 'auto'; buildSalutSettings(); }),
        );

      if (mode === 'auto') {
        new Setting(salutSection)
          .setName('Language')
          .addDropdown(d => {
            for (const key of PRESET_KEYS) {
              d.addOption(key, LANG_PRESETS[key].label);
            }
            d.setValue(cfg.salutationPreset ?? 'it')
             .onChange(v => { cfg.salutationPreset = v; });
          });
        // Show preview of current preset
        const preset = LANG_PRESETS[cfg.salutationPreset ?? 'it'] ?? DEFAULT_SALUT;
        const preview = salutSection.createDiv({ cls: 'setting-item-description' });
        preview.addClass('hp-preview-hint');
        preview.setText(`${preset.morning} / ${preset.afternoon} / ${preset.evening}`);
      }

      if (mode === 'custom') {
        const slots: { key: keyof GreetingConfig; label: string; time: string; fallback: string }[] = [
          { key: 'salutMorning',   label: 'Morning',   time: '5:00–12:00',  fallback: DEFAULT_SALUT.morning },
          { key: 'salutAfternoon', label: 'Afternoon',  time: '12:00–18:00', fallback: DEFAULT_SALUT.afternoon },
          { key: 'salutEvening',   label: 'Evening',    time: '18:00–5:00',  fallback: DEFAULT_SALUT.evening },
        ];
        for (const slot of slots) {
          new Setting(salutSection)
            .setName(`${slot.label} greeting`)
            .setDesc(slot.time)
            .addText(t =>
              t.setValue((cfg[slot.key] as string) ?? slot.fallback)
               .setPlaceholder(slot.fallback)
               .onChange(v => { (cfg as Record<string, unknown>)[slot.key] = v; }),
            );
        }
      }
    };
    buildSalutSettings();

    // ── Emoji ──────────────────────────────────
    new Setting(body).setName('Emoji').setHeading();

    new Setting(body).setName('Show emoji').addToggle(t =>
      t.setValue(cfg.showEmoji ?? true)
       .onChange(v => { cfg.showEmoji = v; buildEmojiSettings(); }),
    );

    const emojiSection = body.createDiv();
    let slotPickers: EmojiPickerInstance[] = [];
    const buildEmojiSettings = () => {
      for (const p of slotPickers) p.destroy();
      slotPickers = [];
      emojiSection.empty();
      if (cfg.showEmoji === false) return;

      new Setting(emojiSection)
        .setName('Emoji mode')
        .setDesc('Auto: based on time of day. Custom: one per time slot. Random: picked from a pool.')
        .addDropdown(d =>
          d.addOption('auto', 'Auto (time of day)')
           .addOption('custom', 'Custom per slot')
           .addOption('random', 'Random pool')
           .setValue(cfg.emojiMode ?? 'auto')
           .onChange(v => { cfg.emojiMode = (v === 'custom' || v === 'random') ? v : 'auto'; buildEmojiSettings(); }),
        );

      const mode = cfg.emojiMode ?? 'auto';

      if (mode === 'custom') {
        const slots: { key: keyof GreetingConfig; label: string; default: string; time: string }[] = [
          { key: 'emojiMorning',   label: 'Morning',   default: '☀️',  time: '5:00–12:00' },
          { key: 'emojiAfternoon', label: 'Afternoon',  default: '🌤️', time: '12:00–17:00' },
          { key: 'emojiEvening',   label: 'Evening',    default: '🌆',  time: '17:00–21:00' },
          { key: 'emojiNight',     label: 'Night',      default: '🌙',  time: '21:00–5:00' },
        ];
        for (const slot of slots) {
          const row = emojiSection.createDiv({ cls: 'setting-item' });
          row.createDiv({ cls: 'setting-item-info' }).createDiv({ cls: 'setting-item-name', text: `${slot.label} emoji (${slot.time})` });
          const control = row.createDiv({ cls: 'setting-item-control' });
          const closePickers = () => { for (const p of slotPickers) p.close(); };
          const picker = createEmojiPicker({
            container: control,
            value: (cfg[slot.key] as string) ?? slot.default,
            placeholder: slot.default,
            onSelect: (emoji) => { (cfg as Record<string, unknown>)[slot.key] = emoji; },
            onClear: () => { (cfg as Record<string, unknown>)[slot.key] = ''; },
            onBeforeOpen: closePickers,
          });
          slotPickers.push(picker);
        }
      }

      if (mode === 'random') {
        // Pool: use multiple emoji pickers in a row, shown as chips
        const poolRow = emojiSection.createDiv({ cls: 'setting-item' });
        const poolInfo = poolRow.createDiv({ cls: 'setting-item-info' });
        poolInfo.createDiv({ cls: 'setting-item-name', text: 'Emoji pool' });
        poolInfo.createDiv({ cls: 'setting-item-description', text: 'Click to add emoji. Remove by clicking the ✕ on each.' });
        const poolControl = poolRow.createDiv({ cls: 'setting-item-control' });
        const poolContainer = poolControl.createDiv({ cls: 'greeting-emoji-pool' });

        const currentPool = parseEmojiPool(cfg.emojiPool ?? '');
        const renderPool = () => {
          poolContainer.empty();
          for (let i = 0; i < currentPool.length; i++) {
            const chip = poolContainer.createDiv({ cls: 'greeting-emoji-chip' });
            chip.createSpan({ text: currentPool[i] });
            const del = chip.createEl('button', { cls: 'greeting-emoji-chip-del', text: '✕' });
            del.addEventListener('click', () => {
              currentPool.splice(i, 1);
              cfg.emojiPool = currentPool.join(' ');
              renderPool();
            });
          }
          // Add button using the emoji picker
          const addBtn = poolContainer.createDiv({ cls: 'greeting-emoji-pool-add' });
          const closePickers = () => { for (const p of slotPickers) p.close(); };
          const addPicker = createEmojiPicker({
            container: addBtn,
            value: '',
            placeholder: '＋',
            onSelect: (emoji) => {
              currentPool.push(emoji);
              cfg.emojiPool = currentPool.join(' ');
              renderPool();
            },
            onClear: () => {},
            onBeforeOpen: closePickers,
          });
          slotPickers.push(addPicker);
        };
        renderPool();

        new Setting(emojiSection)
          .setName('Same emoji all day')
          .setDesc('Pick one at midnight, keep it all day.')
          .addToggle(t =>
            t.setValue(cfg.emojiDailySeed ?? false)
             .onChange(v => { cfg.emojiDailySeed = v; }),
          );
      }
    };
    buildEmojiSettings();
  }
}
