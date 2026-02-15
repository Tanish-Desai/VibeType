import { wordList } from './wordList.js';

export class MeteorShower {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.meteors = [];
        this.menuWords = [];
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.mode = 'menu'; // 'menu' or 'game'

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    createMeteor() {
        const x = Math.random() * this.width + this.width * 0.5; // Start from right
        const y = Math.random() * this.height * 0.5 - this.height * 0.2; // Start from top
        const length = Math.random() * 80 + 20;
        const speed = Math.random() * 10 + 5;
        const angle = Math.PI / 4 + (Math.random() * 0.2 - 0.1); // Diagonal down-left

        this.meteors.push({
            x,
            y,
            length,
            speed,
            angle,
            opacity: Math.random() * 0.5 + 0.1
        });
    }

    createMenuWord() {
        const text = wordList[Math.floor(Math.random() * wordList.length)];
        const x = this.width + 100; // Start off-screen right
        const y = Math.random() * (this.height - 100) + 50;
        const size = Math.random() * 40 + 20; // Random size
        const speed = Math.random() * 2 + 0.5; // Slower speed
        const opacity = Math.random() * 0.2 + 0.1; // More visible: 0.1 to 0.3

        this.menuWords.push({
            text,
            x,
            y,
            size,
            speed,
            opacity
        });
    }

    update() {
        // Add new meteors occasionally
        if (Math.random() < 0.1) {
            this.createMeteor();
        }

        // Add menu words if in menu mode
        if (this.mode === 'menu' && Math.random() < 0.02) {
            this.createMenuWord();
        }

        // Update meteors
        for (let i = this.meteors.length - 1; i >= 0; i--) {
            const m = this.meteors[i];
            m.x -= Math.cos(m.angle) * m.speed;
            m.y += Math.sin(m.angle) * m.speed;

            if (m.x < -100 || m.y > this.height + 100) {
                this.meteors.splice(i, 1);
            }
        }

        // Update menu words
        for (let i = this.menuWords.length - 1; i >= 0; i--) {
            const w = this.menuWords[i];
            w.x -= w.speed;
            
            if (w.x < -200) { // Off screen left
                this.menuWords.splice(i, 1);
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw Menu Words first (behind meteors or mingled)
        if (this.menuWords.length > 0) {
            this.ctx.save();
            this.ctx.font = 'bold 20px "JetBrains Mono"'; // Base font, scaled
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            
            for (const w of this.menuWords) {
                this.ctx.font = `bold ${w.size}px "JetBrains Mono"`;
                // Use a darker color with slightly higher opacity for clarity without brightness interference
                this.ctx.fillStyle = `rgba(100, 100, 100, ${w.opacity})`; 
                this.ctx.fillText(w.text, w.x, w.y);
            }
            this.ctx.restore();
        }

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 2;

        for (const m of this.meteors) {
            this.ctx.beginPath();
            const tailX = m.x + Math.cos(m.angle) * m.length;
            const tailY = m.y - Math.sin(m.angle) * m.length;

            const gradient = this.ctx.createLinearGradient(m.x, m.y, tailX, tailY);
            gradient.addColorStop(0, `rgba(255, 255, 255, ${m.opacity})`);
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

            this.ctx.strokeStyle = gradient;
            this.ctx.moveTo(m.x, m.y);
            this.ctx.lineTo(tailX, tailY);
            this.ctx.stroke();
        }
    }

    animate() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}
