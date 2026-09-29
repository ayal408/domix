/*
 * GHOST HUNTER - a homebrew game for the Nintendo Wii
 *
 * The room is pitch black. Your Wiimote is a flashlight (hold B), a ghost
 * radar (it rumbles faster the closer a hidden ghost is) and a hand-cranked
 * battery charger (SHAKE the Wiimote to recharge). Ghosts flee from light,
 * so sneak up on them, then zap them with A.
 *
 * Built with devkitPPC + libogc, drawn straight into the YUY2 framebuffer.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <gccore.h>
#include <wiiuse/wpad.h>
#include <ogc/lwp_watchdog.h>

#define MAX_GHOSTS   8
#define MAX_FX       8
#define LIGHT_R      92
#define ZAP_R        52
#define AMBIENT      20
#define HUD_H        76

typedef struct { u8 y, cb, cr; } Col;

static const Col C_WHITE  = {235, 128, 128};
static const Col C_YELLOW = {210,  16, 146};
static const Col C_RED    = { 81,  90, 240};
static const Col C_GREEN  = {145,  54,  34};
static const Col C_CYAN   = {170, 166,  16};
static const Col C_GRAY   = { 90, 128, 128};

static GXRModeObj *rmode;
static u32 *xfbs[2];
static u32 *fb;
static int SW, SH, STRIDE, FPS;

/* ---------- low level drawing (YUY2: Y0 Cb Y1 Cr) ---------- */

static inline void put(int x, int y, Col c)
{
	if ((unsigned)x >= (unsigned)SW || (unsigned)y >= (unsigned)SH) return;
	u32 *p = &fb[y * STRIDE + (x >> 1)];
	if (x & 1)
		*p = (*p & 0xFF000000u) | ((u32)c.cb << 16) | ((u32)c.y << 8) | c.cr;
	else
		*p = ((u32)c.y << 24) | ((u32)c.cb << 16) | (*p & 0x0000FF00u) | c.cr;
}

static void rect(int x, int y, int w, int h, Col c)
{
	for (int j = 0; j < h; j++)
		for (int i = 0; i < w; i++)
			put(x + i, y + j, c);
}

static void clear_screen(void)
{
	u32 v = ((u32)AMBIENT << 24) | (132u << 16) | ((u32)AMBIENT << 8) | 124u;
	for (int i = 0; i < STRIDE * SH; i++) fb[i] = v;
}

/* ---------- tiny 5x7 font ---------- */

typedef struct { char c; u8 r[7]; } Glyph;
#define G(ch, a, b, c, d, e, f, g) { ch, { a, b, c, d, e, f, g } }
static const Glyph FONT[] = {
	G('A',0b01110,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001),
	G('B',0b11110,0b10001,0b10001,0b11110,0b10001,0b10001,0b11110),
	G('C',0b01110,0b10001,0b10000,0b10000,0b10000,0b10001,0b01110),
	G('D',0b11110,0b10001,0b10001,0b10001,0b10001,0b10001,0b11110),
	G('E',0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b11111),
	G('F',0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b10000),
	G('G',0b01110,0b10001,0b10000,0b10111,0b10001,0b10001,0b01111),
	G('H',0b10001,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001),
	G('I',0b01110,0b00100,0b00100,0b00100,0b00100,0b00100,0b01110),
	G('K',0b10001,0b10010,0b10100,0b11000,0b10100,0b10010,0b10001),
	G('L',0b10000,0b10000,0b10000,0b10000,0b10000,0b10000,0b11111),
	G('M',0b10001,0b11011,0b10101,0b10101,0b10001,0b10001,0b10001),
	G('N',0b10001,0b11001,0b10101,0b10011,0b10001,0b10001,0b10001),
	G('O',0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110),
	G('P',0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000),
	G('R',0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001),
	G('S',0b01111,0b10000,0b10000,0b01110,0b00001,0b00001,0b11110),
	G('T',0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00100),
	G('U',0b10001,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110),
	G('V',0b10001,0b10001,0b10001,0b10001,0b10001,0b01010,0b00100),
	G('W',0b10001,0b10001,0b10001,0b10101,0b10101,0b11011,0b10001),
	G('X',0b10001,0b10001,0b01010,0b00100,0b01010,0b10001,0b10001),
	G('Y',0b10001,0b10001,0b01010,0b00100,0b00100,0b00100,0b00100),
	G('Z',0b11111,0b00001,0b00010,0b00100,0b01000,0b10000,0b11111),
	G('0',0b01110,0b10001,0b10011,0b10101,0b11001,0b10001,0b01110),
	G('1',0b00100,0b01100,0b00100,0b00100,0b00100,0b00100,0b01110),
	G('2',0b01110,0b10001,0b00001,0b00010,0b00100,0b01000,0b11111),
	G('3',0b11110,0b00001,0b00001,0b01110,0b00001,0b00001,0b11110),
	G('4',0b00010,0b00110,0b01010,0b10010,0b11111,0b00010,0b00010),
	G('5',0b11111,0b10000,0b11110,0b00001,0b00001,0b10001,0b01110),
	G('6',0b00110,0b01000,0b10000,0b11110,0b10001,0b10001,0b01110),
	G('7',0b11111,0b00001,0b00010,0b00100,0b01000,0b01000,0b01000),
	G('8',0b01110,0b10001,0b10001,0b01110,0b10001,0b10001,0b01110),
	G('9',0b01110,0b10001,0b10001,0b01111,0b00001,0b00010,0b01100),
	G(':',0b00000,0b00100,0b00000,0b00000,0b00000,0b00100,0b00000),
	G('!',0b00100,0b00100,0b00100,0b00100,0b00100,0b00000,0b00100),
	G('/',0b00001,0b00010,0b00010,0b00100,0b01000,0b01000,0b10000),
	G('-',0b00000,0b00000,0b00000,0b11111,0b00000,0b00000,0b00000),
};

static void text(int x, int y, int s, Col c, const char *str)
{
	for (; *str; str++, x += 6 * s) {
		for (size_t g = 0; g < sizeof(FONT) / sizeof(FONT[0]); g++) {
			if (FONT[g].c != *str) continue;
			for (int r = 0; r < 7; r++)
				for (int b = 0; b < 5; b++)
					if (FONT[g].r[r] & (1 << (4 - b)))
						rect(x + b * s, y + r * s, s, s, c);
			break;
		}
	}
}

static int text_w(const char *str, int s) { return (int)strlen(str) * 6 * s; }
static void text_c(int y, int s, Col c, const char *str)
{
	text((SW - text_w(str, s)) / 2, y, s, c, str);
}

/* ---------- game state ---------- */

typedef struct { float x, y, vx, vy; int caught, turn; } Ghost;
typedef struct { int x, y, age, hit; } Fx;

enum { ST_TITLE, ST_PLAY, ST_OVER };

static Ghost ghosts[MAX_GHOSTS];
static Fx fx[MAX_FX];
static int n_ghosts, state = ST_TITLE, level, score, hiscore;
static int time_left, frame;
static float battery;
static float px = 320, py = 240;
static int light_on, lx, ly;
static int rumble_left, rumble_state;
static float last_g[3];

static float frand(float a, float b) { return a + (b - a) * ((float)(rand() & 0xFFFF) / 65535.0f); }

static void spawn_level(void)
{
	n_ghosts = 2 + level;
	if (n_ghosts > MAX_GHOSTS) n_ghosts = MAX_GHOSTS;
	for (int i = 0; i < n_ghosts; i++) {
		Ghost *g = &ghosts[i];
		do {
			g->x = frand(50, SW - 50);
			g->y = frand(HUD_H + 40, SH - 50);
		} while (fabsf(g->x - px) < 160 && fabsf(g->y - py) < 160);
		g->vx = g->vy = 0;
		g->caught = 0;
		g->turn = 0;
	}
	time_left = (45 - (level > 6 ? 6 : level)) * FPS;
	memset(fx, 0, sizeof(fx));
}

static void new_game(void)
{
	level = 0;
	score = 0;
	battery = 100;
	state = ST_PLAY;
	spawn_level();
}

static int remaining(void)
{
	int n = 0;
	for (int i = 0; i < n_ghosts; i++) if (!ghosts[i].caught) n++;
	return n;
}

static void add_fx(int x, int y, int hit)
{
	for (int i = 0; i < MAX_FX; i++)
		if (fx[i].age == 0) { fx[i].x = x; fx[i].y = y; fx[i].age = 1; fx[i].hit = hit; return; }
}

/* brightness 0..255 of the flashlight at a screen pixel */
static inline int light_at(int x, int y, int r2)
{
	if (!light_on) return 0;
	int dx = x - lx, dy = y - ly;
	int d2 = dx * dx + dy * dy;
	if (d2 >= r2) return 0;
	int t = ((r2 - d2) << 8) / r2;
	return (t * t) >> 8;
}

static void update(u32 down, u32 held)
{
	frame++;

	/* shake => recharge */
	struct gforce_t gf;
	WPAD_GForce(0, &gf);
	float dg = fabsf(gf.x - last_g[0]) + fabsf(gf.y - last_g[1]) + fabsf(gf.z - last_g[2]);
	last_g[0] = gf.x; last_g[1] = gf.y; last_g[2] = gf.z;
	if (dg > 0.9f) {
		battery += 2.2f;
		if (battery > 100) battery = 100;
	}

	light_on = (held & WPAD_BUTTON_B) && battery > 0;
	if (light_on) battery -= 0.26f;
	if (battery < 0) battery = 0;

	if (down & WPAD_BUTTON_A) {
		if (battery >= 8) {
			battery -= 8;
			int hit = 0;
			for (int i = 0; i < n_ghosts; i++) {
				Ghost *g = &ghosts[i];
				if (g->caught) continue;
				float dx = g->x - px, dy = g->y - py;
				if (dx * dx + dy * dy < ZAP_R * ZAP_R) {
					g->caught = 1;
					hit++;
					score += 100;
				}
			}
			add_fx((int)px, (int)py, hit);
			if (hit) rumble_left = 14;
		}
	}

	int nearest = 9999;
	for (int i = 0; i < n_ghosts; i++) {
		Ghost *g = &ghosts[i];
		if (g->caught) continue;
		float dx = g->x - px, dy = g->y - py;
		float d = sqrtf(dx * dx + dy * dy);
		if (d < nearest) nearest = (int)d;

		if (light_on && d < LIGHT_R) {
			/* ghosts hate light: flee, with a little panic */
			float k = 3.4f / (d + 1.0f);
			g->vx = dx * k + frand(-0.6f, 0.6f);
			g->vy = dy * k + frand(-0.6f, 0.6f);
			g->turn = 20;
		} else if (--g->turn <= 0) {
			float a = frand(0, 6.2831f), s = frand(0.3f, 1.3f + 0.15f * level);
			g->vx = cosf(a) * s;
			g->vy = sinf(a) * s;
			g->turn = 30 + rand() % 60;
		}
		g->x += g->vx;
		g->y += g->vy;
		if (g->x < 30)        { g->x = 30;        g->vx = fabsf(g->vx); }
		if (g->x > SW - 30)   { g->x = SW - 30;   g->vx = -fabsf(g->vx); }
		if (g->y < HUD_H + 30){ g->y = HUD_H + 30;g->vy = fabsf(g->vy); }
		if (g->y > SH - 30)   { g->y = SH - 30;   g->vy = -fabsf(g->vy); }
	}

	/* radar: closer ghost => faster rumble pulses */
	int want = 0;
	if (rumble_left > 0) { want = 1; rumble_left--; }
	else if (nearest < 380) {
		int period = nearest / 6;
		if (period < 6) period = 6;
		if (period > 60) period = 60;
		want = (frame % period) < 3;
	}
	if (want != rumble_state) { WPAD_Rumble(0, want); rumble_state = want; }

	for (int i = 0; i < MAX_FX; i++)
		if (fx[i].age && ++fx[i].age > 24) fx[i].age = 0;

	if (remaining() == 0) {
		score += (time_left / FPS) * 10;
		level++;
		battery += 25;
		if (battery > 100) battery = 100;
		spawn_level();
	} else if (--time_left <= 0) {
		if (score > hiscore) hiscore = score;
		state = ST_OVER;
		if (rumble_state) { WPAD_Rumble(0, 0); rumble_state = 0; }
	}
}

/* ---------- rendering ---------- */

static void draw_light(void)
{
	if (!light_on) return;
	int R = LIGHT_R;
	if (battery < 15 && (rand() % 100) < 35) R = LIGHT_R / 2;   /* dying flicker */
	int r2 = R * R;
	int x0 = (lx - R) & ~1, x1 = lx + R, y0 = ly - R, y1 = ly + R;
	if (x0 < 0) x0 = 0;
	if (x1 > SW - 2) x1 = SW - 2;
	if (y0 < 0) y0 = 0;
	if (y1 > SH - 1) y1 = SH - 1;
	for (int y = y0; y <= y1; y++) {
		u32 *row = &fb[y * STRIDE];
		for (int x = x0; x <= x1; x += 2) {
			int i0 = light_at(x, y, r2), i1 = light_at(x + 1, y, r2);
			if (!(i0 | i1)) continue;
			int grid0 = (x % 48 == 0) || (y % 48 == 0);
			int grid1 = ((x + 1) % 48 == 0) || (y % 48 == 0);
			int y0v = AMBIENT + ((i0 * (grid0 ? 215 : 150)) >> 8);
			int y1v = AMBIENT + ((i1 * (grid1 ? 215 : 150)) >> 8);
			int ia = (i0 + i1) >> 1;
			int cb = 128 - ((ia * 34) >> 8);
			int cr = 128 + ((ia * 14) >> 8);
			row[x >> 1] = ((u32)y0v << 24) | ((u32)cb << 16) | ((u32)y1v << 8) | (u32)cr;
		}
	}
}

static void draw_ghost(const Ghost *g, int r2)
{
	int gx0 = (int)g->x, gy0 = (int)g->y;
	for (int y = -22; y <= 22; y++) {
		for (int x = -22; x <= 22; x++) {
			int in;
			if (y <= 0) in = x * x + y * y <= 20 * 20;
			else in = (abs(x) <= 20) && (y <= 20 - (((x + 30 + frame / 4) / 6) & 1) * 5);
			if (!in) continue;
			int i = light_at(gx0 + x, gy0 + y, r2);
			if (!i) continue;
			int ex = abs(abs(x) - 8), ey = y + 5;
			int eye = ex * ex + ey * ey <= 16;
			Col c;
			if (eye) c = (Col){ (u8)(AMBIENT + 6), 128, 128 };
			else c = (Col){ (u8)(AMBIENT + ((i * 215) >> 8)), (u8)(128 + ((i * 20) >> 8)), (u8)(128 - ((i * 14) >> 8)) };
			put(gx0 + x, gy0 + y, c);
		}
	}
}

static void draw_ring(int cx, int cy, int r, int th, Col c)
{
	for (int y = -r - th; y <= r + th; y++)
		for (int x = -r - th; x <= r + th; x++) {
			int d2 = x * x + y * y;
			if (d2 >= (r - th) * (r - th) && d2 <= (r + th) * (r + th))
				put(cx + x, cy + y, c);
		}
}

static void draw_bar(int x, int y, int w, int h, float frac, Col c)
{
	rect(x - 2, y - 2, w + 4, h + 4, C_GRAY);
	rect(x, y, w, h, (Col){ 16, 128, 128 });
	if (frac < 0) frac = 0;
	if (frac > 1) frac = 1;
	rect(x, y, (int)(w * frac), h, c);
}

static void draw_hud(void)
{
	char buf[48];
	sprintf(buf, "GHOSTS %d/%d", n_ghosts - remaining(), n_ghosts);
	text(20, 10, 3, C_WHITE, buf);
	sprintf(buf, "LEVEL %d", level + 1);
	text_c(10, 3, C_CYAN, buf);
	sprintf(buf, "SCORE %d", score);
	text(SW - 20 - text_w(buf, 3), 10, 3, C_YELLOW, buf);

	text(20, 44, 2, C_WHITE, "POWER");
	Col bc = battery < 20 ? C_RED : C_GREEN;
	draw_bar(112, 44, 190, 14, battery / 100.0f, bc);
	if (battery < 20 && (frame & 16)) text(312, 44, 2, C_RED, "SHAKE!");
	text(400, 44, 2, C_WHITE, "TIME");
	draw_bar(470, 44, 150, 14, (float)time_left / (45 * FPS), time_left < 10 * FPS ? C_RED : C_CYAN);
}

static void draw_play(void)
{
	clear_screen();
	int R = LIGHT_R, r2 = R * R;
	draw_light();

	for (int i = 0; i < n_ghosts; i++) {
		const Ghost *g = &ghosts[i];
		if (g->caught) continue;
		draw_ghost(g, r2);
		/* unseen ghosts still stare at you from the dark when close */
		float dx = g->x - px, dy = g->y - py;
		float d = sqrtf(dx * dx + dy * dy);
		if (d < 200 && light_at((int)g->x, (int)g->y, r2) == 0 && (frame & 63) > 3) {
			u8 v = (u8)(30 + (200 - d) * 0.6f);
			Col e = { v, 90, 240 };
			rect((int)g->x - 12, (int)g->y - 6, 5, 5, e);
			rect((int)g->x + 7,  (int)g->y - 6, 5, 5, e);
		}
	}

	for (int i = 0; i < MAX_FX; i++) {
		if (!fx[i].age) continue;
		if (fx[i].hit) draw_ring(fx[i].x, fx[i].y, fx[i].age * 4, 4, C_YELLOW);
		else draw_ring(fx[i].x, fx[i].y, ZAP_R - fx[i].age, 2, C_RED);
	}

	rect(0, 0, SW, HUD_H, (Col){ 16, 128, 128 });
	draw_hud();

	/* crosshair */
	Col c = light_on ? (Col){ 16, 128, 128 } : C_WHITE;
	rect((int)px - 10, (int)py - 1, 20, 2, c);
	rect((int)px - 1, (int)py - 10, 2, 20, c);
}

static void draw_title(void)
{
	clear_screen();
	for (int i = 0; i < 6; i++) {
		int ex = 60 + i * 100 + (int)(20 * sinf((frame + i * 37) * 0.03f));
		int ey = 300 + (int)(30 * cosf((frame + i * 51) * 0.025f));
		Col e = { 80, 90, 240 };
		rect(ex, ey, 6, 6, e);
		rect(ex + 20, ey, 6, 6, e);
	}
	text_c(70, 9, C_WHITE, "GHOST");
	text_c(150, 9, C_CYAN, "HUNTER");
	text_c(260, 3, C_YELLOW, "HOLD B: FLASHLIGHT");
	text_c(300, 3, C_YELLOW, "A: ZAP GHOSTS");
	text_c(340, 3, C_YELLOW, "SHAKE: RECHARGE");
	text_c(380, 3, C_WHITE,  "RUMBLE = GHOST RADAR");
	if (frame & 32) text_c(430, 4, C_GREEN, "PRESS A");
}

static void draw_over(void)
{
	char buf[48];
	clear_screen();
	text_c(110, 8, C_RED, "GAME OVER");
	sprintf(buf, "SCORE %d", score);
	text_c(220, 4, C_YELLOW, buf);
	sprintf(buf, "BEST %d", hiscore);
	text_c(270, 4, C_CYAN, buf);
	sprintf(buf, "REACHED LEVEL %d", level + 1);
	text_c(330, 3, C_WHITE, buf);
	if (frame & 32) text_c(410, 4, C_GREEN, "PRESS A");
}

/* ---------- main ---------- */

static void init_video(void)
{
	VIDEO_Init();
	rmode = VIDEO_GetPreferredMode(NULL);
	xfbs[0] = MEM_K0_TO_K1(SYS_AllocateFramebuffer(rmode));
	xfbs[1] = MEM_K0_TO_K1(SYS_AllocateFramebuffer(rmode));
	VIDEO_Configure(rmode);
	VIDEO_SetNextFramebuffer(xfbs[0]);
	VIDEO_SetBlack(false);
	VIDEO_Flush();
	VIDEO_WaitVSync();
	if (rmode->viTVMode & VI_NON_INTERLACE) VIDEO_WaitVSync();

	SW = rmode->fbWidth;
	SH = rmode->xfbHeight;
	STRIDE = SW / 2;
	FPS = (rmode->viTVMode >> 2) == VI_PAL ? 50 : 60;
}

int main(int argc, char **argv)
{
	init_video();
	WPAD_Init();
	WPAD_SetDataFormat(0, WPAD_FMT_BTNS_ACC_IR);
	WPAD_SetVRes(0, SW, SH);
	srand((unsigned)gettime());

	int cur = 0;
	for (;;) {
		WPAD_ScanPads();
		u32 down = WPAD_ButtonsDown(0), held = WPAD_ButtonsHeld(0);
		if (down & WPAD_BUTTON_HOME) break;

		WPADData *d = WPAD_Data(0);
		if (d && d->ir.valid) {
			px = d->ir.x;
			py = d->ir.y;
		} else {                        /* no sensor bar? D-pad fallback */
			if (held & WPAD_BUTTON_LEFT)  px -= 6;
			if (held & WPAD_BUTTON_RIGHT) px += 6;
			if (held & WPAD_BUTTON_UP)    py -= 6;
			if (held & WPAD_BUTTON_DOWN)  py += 6;
		}
		if (px < 0) px = 0;
		if (px > SW - 1) px = SW - 1;
		if (py < 0) py = 0;
		if (py > SH - 1) py = SH - 1;
		lx = (int)px;
		ly = (int)py;

		fb = xfbs[cur];
		switch (state) {
		case ST_TITLE:
			frame++;
			draw_title();
			if (down & WPAD_BUTTON_A) new_game();
			break;
		case ST_PLAY:
			update(down, held);
			draw_play();
			break;
		case ST_OVER:
			frame++;
			draw_over();
			if (down & WPAD_BUTTON_A) new_game();
			break;
		}

		VIDEO_SetNextFramebuffer(xfbs[cur]);
		VIDEO_Flush();
		VIDEO_WaitVSync();
		cur ^= 1;
	}

	if (rumble_state) WPAD_Rumble(0, 0);
	return 0;
}
