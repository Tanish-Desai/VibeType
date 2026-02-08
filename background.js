export class MeteorShower {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.meteors = [];
        this.width = window.innerWidth;
        this.height = window.innerHeight;

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
        const x = Math.random() * this.width + this.width * 0.5; // Start from right side mostly
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

    update() {
        // Add new meteors occasionally
        if (Math.random() < 0.1) {
            this.createMeteor();
        }

        // Update positions
        for (let i = this.meteors.length - 1; i >= 0; i--) {
            const m = this.meteors[i];
            m.x -= Math.cos(m.angle) * m.speed;
            m.y += Math.sin(m.angle) * m.speed;

            // Remove if out of bounds
            if (m.x < -100 || m.y > this.height + 100) {
                this.meteors.splice(i, 1);
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

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
