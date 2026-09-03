/* ========================================
   POKÉMON GRADED CARDS - JAVASCRIPT
   ======================================== */

// ========================================
// 1. MOBILE MENU TOGGLE
// ========================================

/**
 * Handles mobile hamburger menu toggle
 * Shows/hides navigation menu on mobile devices
 */
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        // Toggle the 'active' class on the nav menu
        navMenu.classList.toggle('active');
        
        // Toggle hamburger animation (optional)
        hamburger.classList.toggle('active');
    });
}

// Close mobile menu when a link is clicked
const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        if (hamburger) hamburger.classList.remove('active');
    });
});

// ========================================
// 2. ACTIVE NAVIGATION LINK HIGHLIGHTING
// ========================================

/**
 * Updates the active nav link based on current scroll position
 * Uses Intersection Observer for performance
 */
const sections = document.querySelectorAll('section[id]');

const observerOptions = {
    threshold: 0.3,
    rootMargin: '-50px 0px -50px 0px'
};

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Remove active class from all links
            navLinks.forEach(link => link.classList.remove('active'));
            
            // Add active class to the corresponding link
            const activeLink = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
            }
        }
    });
}, observerOptions);

sections.forEach(section => sectionObserver.observe(section));

// ========================================
// 3. SEARCH FUNCTIONALITY
// ========================================

/**
 * Handles search bar functionality
 * Filters cards based on search input
 */
const searchInput = document.getElementById('searchInput');
const searchBtn = document.querySelector('.search-btn');
const cards = document.querySelectorAll('.card');

function filterCards(searchTerm) {
    const term = searchTerm.toLowerCase();
    
    cards.forEach(card => {
        const title = card.querySelector('.card-title').textContent.toLowerCase();
        const set = card.querySelector('.card-set').textContent.toLowerCase();
        
        // Show card if search term matches title or set
        if (title.includes(term) || set.includes(term) || term === '') {
            card.style.display = '';
            // Add fade-in animation
            card.style.opacity = '0';
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transition = 'opacity 0.3s ease';
            }, 10);
        } else {
            card.style.display = 'none';
        }
    });
}

// Search on button click
if (searchBtn) {
    searchBtn.addEventListener('click', () => {
        const searchTerm = searchInput.value.trim();
        filterCards(searchTerm);
        
        // Show feedback message
        if (searchTerm) {
            console.log(`Searching for: ${searchTerm}`);
        }
    });
}

// Search on Enter key press
if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });
}

// ========================================
// 4. FILTER FUNCTIONALITY
// ========================================

/**
 * Handles card filtering by grade, type, and price
 * Combines multiple filters
 */
const gradeFilter = document.getElementById('gradeFilter');
const typeFilter = document.getElementById('typeFilter');
const priceFilter = document.getElementById('priceFilter');

// Sample card data for filtering (in production, this would come from a database)
const cardData = {
    'Charizard Base Set': { grade: 9, type: 'fire', price: 2500 },
    'Blastoise Base Set': { grade: 8, type: 'water', price: 1800 },
    'Venusaur Base Set': { grade: 9, type: 'grass', price: 2200 },
    'Dragonite Holo': { grade: 10, type: 'electric', price: 3500 },
    'Gyarados Holo': { grade: 8, type: 'water', price: 1200 },
    'Arcanine Holo': { grade: 9, type: 'fire', price: 1600 }
};

function applyFilters() {
    const selectedGrade = gradeFilter.value;
    const selectedType = typeFilter.value;
    const selectedPrice = priceFilter.value;
    
    cards.forEach(card => {
        const cardTitle = card.querySelector('.card-title').textContent;
        const cardInfo = cardData[cardTitle];
        
        if (!cardInfo) return; // Skip if no data
        
        let matches = true;
        
        // Check grade filter
        if (selectedGrade && cardInfo.grade != selectedGrade) {
            matches = false;
        }
        
        // Check type filter
        if (selectedType && cardInfo.type !== selectedType) {
            matches = false;
        }
        
        // Check price filter
        if (selectedPrice) {
            const [min, max] = selectedPrice.split('-').map(p => p === '+' ? Infinity : parseInt(p));
            if (selectedPrice === '500+') {
                if (cardInfo.price < 500) matches = false;
            } else {
                if (cardInfo.price < min || cardInfo.price > max) {
                    matches = false;
                }
            }
        }
        
        // Show or hide card
        card.style.display = matches ? '' : 'none';
    });
}

// Add event listeners to filter dropdowns
if (gradeFilter) gradeFilter.addEventListener('change', applyFilters);
if (typeFilter) typeFilter.addEventListener('change', applyFilters);
if (priceFilter) priceFilter.addEventListener('change', applyFilters);

// ========================================
// 5. VIEW DETAILS BUTTON FUNCTIONALITY
// ========================================

/**
 * Handles "View Details" button clicks
 * Currently shows an alert (can be replaced with modal or page navigation)
 */
const viewBtns = document.querySelectorAll('.view-btn');

viewBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        
        const cardTitle = btn.parentElement.querySelector('.card-title').textContent;
        const cardSet = btn.parentElement.querySelector('.card-set').textContent;
        const price = btn.parentElement.querySelector('.price').textContent;
        
        // In production, this would navigate to a detailed card page
        console.log(`Viewing details for: ${cardTitle} - ${cardSet} - ${price}`);
        
        // Show a simple notification
        showNotification(`Loading details for ${cardTitle}...`);
    });
});

// ========================================
// 6. CONTACT FORM HANDLING
// ========================================

/**
 * Handles contact form submission
 * Validates input and shows success message
 */
const contactForm = document.querySelector('.contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Get form values
        const nameInput = contactForm.querySelector('input[type="text"]');
        const emailInput = contactForm.querySelector('input[type="email"]');
        const messageInput = contactForm.querySelector('textarea');
        
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const message = messageInput.value.trim();
        
        // Basic validation
        if (!name || !email || !message) {
            showNotification('Please fill in all fields', 'error');
            return;
        }
        
        // Email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }
        
        // In production, send this data to a server
        console.log('Form submitted:', { name, email, message });
        
        // Show success message
        showNotification('Message sent successfully! We\'ll get back to you soon.', 'success');
        
        // Reset form
        contactForm.reset();
    });
}

// ========================================
// 7. CALL TO ACTION BUTTON
// ========================================

/**
 * Handles main CTA button click
 * Scrolls to browse section
 */
const ctaButton = document.querySelector('.cta-button');

if (ctaButton) {
    ctaButton.addEventListener('click', () => {
        const browseSection = document.getElementById('browse');
        if (browseSection) {
            browseSection.scrollIntoView({ behavior: 'smooth' });
        }
    });
}

// ========================================
// 8. NOTIFICATION SYSTEM
// ========================================

/**
 * Displays a temporary notification message
 * @param {string} message - The notification message
 * @param {string} type - Type of notification: 'success', 'error', 'info'
 */
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 300px;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// ========================================
// 9. SMOOTH SCROLL POLYFILL CHECK
// ========================================

/**
 * Check if browser supports smooth scroll, add polyfill message if not
 */
if (!CSS.supports('scroll-behavior', 'smooth')) {
    console.log('Smooth scroll not supported - consider adding a polyfill');
}

// ========================================
// 10. LAZY LOAD CARDS (Optional Enhancement)
// ========================================

/**
 * Implements lazy loading for card images
 * Useful for performance optimization
 */
const cardImages = document.querySelectorAll('.card-image');

const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const image = entry.target;
            // In production, load actual image here
            image.style.opacity = '1';
            imageObserver.unobserve(image);
        }
    });
}, { threshold: 0.1 });

cardImages.forEach(image => imageObserver.observe(image));

// ========================================
// 11. KEYBOARD ACCESSIBILITY
// ========================================

/**
 * Enhance keyboard navigation
 * Allow Tab and Enter to navigate through cards
 */
document.addEventListener('keydown', (e) => {
    // Close mobile menu on Escape
    if (e.key === 'Escape' && navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        if (hamburger) hamburger.classList.remove('active');
    }
});

// ========================================
// 12. INITIALIZATION
// ========================================

/**
 * Initialize all components when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Pokémon Graded Cards website loaded successfully!');
    
    // Add any additional initialization code here
    
    // Set first nav link as active by default
    if (navLinks.length > 0) {
        navLinks[0].classList.add('active');
    }
});

// ========================================
// 13. UTILITY FUNCTIONS
// ========================================

/**
 * Utility: Get element by ID
 */
function getById(id) {
    return document.getElementById(id);
}

/**
 * Utility: Get all elements by class name
 */
function getByClass(className) {
    return document.querySelectorAll(`.${className}`);
}

/**
 * Utility: Format price to USD currency
 */
function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(price);
}

// ========================================
// 14. ANIMATION KEYFRAMES (CSS DEFINED)
// ========================================

// Note: The following animations are defined in style.css:
// - slideInDown: Slides elements in from top
// - slideInUp: Slides elements in from bottom
// - slideInRight: Slides elements in from right (for notifications)
// - slideOutRight: Slides elements out to right (for notifications)

/* End of script.js */
