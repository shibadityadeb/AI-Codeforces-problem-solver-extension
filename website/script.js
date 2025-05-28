// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Download Chrome Extension Handler
document.getElementById('downloadChrome').addEventListener('click', function(e) {
    e.preventDefault();
    
    // Show download notification
    alert('Extension package will be downloaded. Please follow the manual installation instructions that will appear.');
    
    // Detailed installation instructions
    const instructions = `
Manual Installation Instructions:

1. Download the extension files
2. Open Chrome and go to chrome://extensions/
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the extracted extension folder
6. The extension will appear in your browser toolbar
7. Click the extension icon and enter your OpenRouter API key
8. Visit any Codeforces problem page to launch the AI chatbot

The extension files have been packaged for you to download.
    `;
    
    setTimeout(() => {
        alert(instructions);
    }, 1000);
});

// View Source Code Handler
document.getElementById('viewSource').addEventListener('click', function(e) {
    e.preventDefault();
    alert('GitHub repository will be available soon. For now, the source code is included in the download package.');
});

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Initialize fade-in animations
document.querySelectorAll('.fade-in-up').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease-out';
    observer.observe(el);
});

// Header background change on scroll
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (window.scrollY > 100) {
        header.style.background = 'rgba(102, 126, 234, 0.95)';
    } else {
        header.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
});

// Add loading animation for buttons
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-2px)';
    });
    
    btn.addEventListener('mouseleave', function() {
        if (!this.matches(':hover')) {
            this.style.transform = 'translateY(0)';
        }
    });
});

// Feature cards hover effects
document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-10px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) scale(1)';
    });
});

// Step cards hover effects
document.querySelectorAll('.step').forEach(step => {
    step.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-5px)';
        this.querySelector('.step-number').style.transform = 'scale(1.1)';
    });
    
    step.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.querySelector('.step-number').style.transform = 'scale(1)';
    });
});

// Add click tracking for analytics (placeholder)
function trackClick(element, action) {
    console.log(`User clicked: ${action} on ${element}`);
    // Here you can add actual analytics tracking like Google Analytics
    // gtag('event', 'click', { 'event_category': 'button', 'event_label': action });
}

// Track important button clicks
document.getElementById('downloadChrome').addEventListener('click', () => {
    trackClick('download-button', 'chrome-extension-download');
});

document.getElementById('viewSource').addEventListener('click', () => {
    trackClick('source-button', 'view-source-code');
});

// Mobile menu toggle (for future mobile navigation)
function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    navLinks.classList.toggle('mobile-active');
}

// Add mobile menu styles dynamically if needed
if (window.innerWidth <= 768) {
    const style = document.createElement('style');
    style.textContent = `
        .nav-links.mobile-active {
            display: flex;
            flex-direction: column;
            position: absolute;
            top: 100%;
            left: 0;
            width: 100%;
            background: rgba(102, 126, 234, 0.95);
            padding: 1rem;
            backdrop-filter: blur(10px);
        }
        
        .mobile-menu-btn {
            display: block;
            background: none;
            border: none;
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
        }
        
        @media (min-width: 769px) {
            .mobile-menu-btn {
                display: none;
            }
        }
    `;
    document.head.appendChild(style);
}

// Smooth scroll to top functionality
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Show scroll to top button when user scrolls down
let scrollToTopBtn = null;

window.addEventListener('scroll', () => {
    if (window.scrollY > 500) {
        if (!scrollToTopBtn) {
            scrollToTopBtn = document.createElement('button');
            scrollToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
            scrollToTopBtn.className = 'scroll-to-top';
            scrollToTopBtn.onclick = scrollToTop;
            
            // Add styles
            Object.assign(scrollToTopBtn.style, {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                zIndex: '1000',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.3s ease',
                opacity: '0',
                transform: 'translateY(20px)'
            });
            
            document.body.appendChild(scrollToTopBtn);
            
            // Animate in
            setTimeout(() => {
                scrollToTopBtn.style.opacity = '1';
                scrollToTopBtn.style.transform = 'translateY(0)';
            }, 100);
        }
    } else if (scrollToTopBtn) {
        scrollToTopBtn.style.opacity = '0';
        scrollToTopBtn.style.transform = 'translateY(20px)';
        setTimeout(() => {
            if (scrollToTopBtn && scrollToTopBtn.parentNode) {
                scrollToTopBtn.parentNode.removeChild(scrollToTopBtn);
                scrollToTopBtn = null;
            }
        }, 300);
    }
});

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Codeforces AI Assistant Landing Page Loaded');
    
    
    if (localStorage.getItem('visited')) {
        console.log('Welcome back!');
    } else {
        localStorage.setItem('visited', 'true');
        console.log('Welcome to Codeforces AI Assistant!');
    }
});