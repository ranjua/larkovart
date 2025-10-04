// Modern Artist Website JavaScript

let config = null;

// Load header HTML
async function loadHeader() {
    try {
        const response = await fetch('header.html');
        const headerHTML = await response.text();
        const body = document.body;
        body.insertAdjacentHTML('afterbegin', headerHTML);
        return true;
    } catch (error) {
        console.error('Error loading header:', error);
        return false;
    }
}

// Load footer HTML
async function loadFooter() {
    try {
        const response = await fetch('footer.html');
        const footerHTML = await response.text();
        const body = document.body;
        body.insertAdjacentHTML('beforeend', footerHTML);
        return true;
    } catch (error) {
        console.error('Error loading footer:', error);
        return false;
    }
}

// Load configuration
async function loadConfig() {
    try {
        const response = await fetch('config.json');
        config = await response.json();
        console.log('Config loaded:', config);
        return config;
    } catch (error) {
        console.error('Error loading config:', error);
        return null;
    }
}

// Populate navigation
function populateNavigation() {
    if (!config) return;

    const navContainer = document.querySelector('.nav-container');
    if (!navContainer) return;

    // Update logo
    const logo = navContainer.querySelector('.logo');
    if (logo) logo.textContent = config.general.siteTitle;

    // Update nav menu
    const navMenu = navContainer.querySelector('.nav-menu');
    if (navMenu) {
        navMenu.innerHTML = '';
        config.general.navigation.forEach(item => {
            // Skip hidden navigation items
            if (item.hidden === true) return;

            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = item.url;
            a.textContent = item.label;
            li.appendChild(a);
            navMenu.appendChild(li);
        });
    }

    // Update nav social media
    const navSocial = navContainer.querySelector('.nav-social');
    if (navSocial && config.general.socialMedia) {
        navSocial.innerHTML = '';
        config.general.socialMedia.forEach(social => {
            const link = document.createElement('a');
            link.href = social.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.title = `${social.platform} - ${config.general.artistName}`;
            link.className = 'nav-social-link';

            const icon = document.createElement('img');
            icon.className = 'social-icon';
            icon.src = social.icon;
            icon.alt = `${social.platform} icon`;
            icon.loading = 'lazy';

            link.appendChild(icon);
            navSocial.appendChild(link);
        });
    }
}

// Populate hero section
function populateHero() {
    if (!config) return;

    const heroContent = document.querySelector('.hero-content');
    if (!heroContent) return;

    const h1 = heroContent.querySelector('h1');
    const p = heroContent.querySelector('p');
    const cta = heroContent.querySelector('.cta-button');

    if (h1) h1.textContent = config.general.heroTitle;
    if (p) p.textContent = config.general.heroSubtitle;
    if (cta) {
        cta.textContent = config.general.ctaText;
        cta.href = config.general.ctaUrl;
    }
}

// Populate bio preview section (for homepage)
function populateBioPreview() {
    if (!config) return;

    const bioContent = document.querySelector('.bio-content');
    if (!bioContent) return;

    const bioPreview = config.general.bioPreview;

    // Update bio text
    const bioText = bioContent.querySelector('.bio-text');
    if (bioText) {
        const h2 = bioText.querySelector('h2');
        const paragraphs = bioText.querySelectorAll('p');
        const cta = bioText.querySelector('.cta-button');

        if (h2) h2.textContent = bioPreview.title;
        if (paragraphs.length >= 2) {
            paragraphs[0].textContent = bioPreview.description1;
            paragraphs[1].textContent = bioPreview.description2;
        }
        if (cta) {
            cta.textContent = bioPreview.ctaText;
            cta.href = bioPreview.ctaUrl;
        }
    }

    // Update bio image
    const bioImage = bioContent.querySelector('.bio-image');
    if (bioImage) {
        bioImage.src = bioPreview.imageUrl;
        bioImage.alt = bioPreview.imageAlt;
    }
}

// Populate footer
function populateFooter() {
    if (!config) return;

    const footer = document.querySelector('footer');
    if (!footer) return;

    // Populate footer text
    const footerText = footer.querySelector('p');
    if (footerText) footerText.innerHTML = config.general.footerText;

    // Populate social media links
    const socialMediaContainer = footer.querySelector('.social-media');
    if (socialMediaContainer && config.general.socialMedia) {
        socialMediaContainer.innerHTML = '';
        config.general.socialMedia.forEach(social => {
            const link = document.createElement('a');
            link.href = social.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.title = `${social.platform} - ${config.general.artistName}`;
            link.className = 'social-link';
            link.setAttribute('data-platform', social.platform.toLowerCase());

            const icon = document.createElement('img');
            icon.className = 'social-icon';
            icon.src = social.icon;
            icon.alt = `${social.platform} icon`;
            icon.loading = 'lazy';

            link.appendChild(icon);
            socialMediaContainer.appendChild(link);
        });
    }
}

// Populate bio section
function populateBio() {
    if (!config) return;

    const bioContent = document.querySelector('.bio-content');
    if (!bioContent) return;

    const bioData = config.pages.bio;

    // Update page title and meta description
    document.title = `${bioData.title} - ${config.general.siteTitle}`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = bioData.description;

    // Update main heading (h2 is a sibling of bio-content, not inside it)
    const bioSection = document.querySelector('.bio');
    const mainHeading = bioSection ? bioSection.querySelector('h2') : null;
    if (mainHeading) mainHeading.textContent = bioData.title;

    // Update bio text sections
    const bioText = bioContent.querySelector('.bio-text');
    if (bioText && bioData.sections) {
        // Clear existing content except the main heading
        const existingHeading = bioText.querySelector('h2');
        bioText.innerHTML = '';
        if (existingHeading) bioText.appendChild(existingHeading);

        bioData.sections.forEach(section => {
            const heading = document.createElement('h3');
            heading.textContent = section.heading;

            const paragraph = document.createElement('p');
            paragraph.textContent = section.content;

            bioText.appendChild(heading);
            bioText.appendChild(paragraph);
        });

        // Add CTA button
        const ctaButton = document.createElement('a');
        ctaButton.href = config.general.bioPreview.ctaUrl;
        ctaButton.className = 'cta-button';
        ctaButton.textContent = config.general.bioPreview.ctaText;
        bioText.appendChild(ctaButton);
    }

    // Update bio image
    const bioImage = bioContent.querySelector('.bio-image');
    if (bioImage) {
        bioImage.src = config.general.bioPreview.imageUrl;
        bioImage.alt = config.general.bioPreview.imageAlt;
    }

    // Add artist statement section
    if (bioData.artistStatement) {
        const artistStatementSection = document.createElement('div');
        artistStatementSection.style.marginTop = '3rem';
        artistStatementSection.style.textAlign = 'center';

        const statementTitle = document.createElement('h3');
        statementTitle.textContent = bioData.artistStatement.title;

        const quote = document.createElement('blockquote');
        quote.style.fontStyle = 'italic';
        quote.style.fontSize = '1.2rem';
        quote.style.color = 'var(--primary-color)';
        quote.style.margin = '2rem 0';
        quote.style.maxWidth = '600px';
        quote.style.marginLeft = 'auto';
        quote.style.marginRight = 'auto';
        quote.textContent = bioData.artistStatement.quote;

        const attribution = document.createElement('p');
        attribution.style.marginTop = '2rem';
        attribution.textContent = bioData.artistStatement.attribution;

        artistStatementSection.appendChild(statementTitle);
        artistStatementSection.appendChild(quote);
        artistStatementSection.appendChild(attribution);

        bioContent.parentNode.insertBefore(artistStatementSection, bioContent.nextSibling);
    }
}

// Populate gallery
function populateGallery(galleryType) {
    if (!config || !config.assets[galleryType]) return;

    const gallery = document.querySelector('.gallery');
    if (!gallery) return;

    const galleryData = config.assets[galleryType];
    const pageData = config.pages[galleryType];

    // Update page title and meta description
    if (pageData) {
        document.title = `${pageData.title} - ${config.general.siteTitle}`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.content = pageData.description;
    }

    // Update title
    const h2 = gallery.querySelector('h2');
    if (h2 && pageData) h2.textContent = pageData.title;

    // Clear existing content
    const embedContainer = gallery.querySelector('.embed-container');
    const galleryGrid = gallery.querySelector('.gallery-grid');

    if (embedContainer) embedContainer.style.display = 'none';
    if (galleryGrid) galleryGrid.innerHTML = '';

    // Populate media array
    if (galleryData.media && galleryData.media.length > 0) {
        galleryData.media.forEach((mediaItem, index) => {
            if (index === 0) {
                // First item: large and centered
                populateFeaturedItem(mediaItem, gallery);
            } else {
                // Subsequent items: medium gallery items
                populateGalleryItem(mediaItem, galleryGrid);
            }
        });
    }
}

function populateFeaturedItem(mediaItem, gallery) {
    const embedContainer = gallery.querySelector('.embed-container');
    if (!embedContainer) return;

    embedContainer.style.display = 'block';

    // Add click handler to open modal
    embedContainer.style.cursor = 'pointer';
    embedContainer.addEventListener('click', () => openModal(mediaItem));

    if (mediaItem.type === 'video') {
        if (isLocalVideo(mediaItem.url)) {
            // Local video file
            embedContainer.innerHTML = `
                <video controls style="width: 100%; height: auto; max-height: 600px;">
                    <source src="${mediaItem.url}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            `;
        } else {
            // Embed URL (YouTube, etc.)
            const iframe = embedContainer.querySelector('iframe');
            if (iframe) {
                iframe.src = mediaItem.url;
                iframe.title = mediaItem.title;
            }
        }
    } else if (mediaItem.type === 'render3d') {
        const iframe = embedContainer.querySelector('iframe');
        if (iframe) {
            iframe.src = mediaItem.url;
            iframe.title = mediaItem.title;
        }
    } else if (mediaItem.type === 'image') {
        // For featured image, create a large image display
        embedContainer.innerHTML = `
            <div class="featured-image-container">
                <img src="${mediaItem.url}" alt="${mediaItem.title}" style="width: 100%; height: auto; max-height: 600px; object-fit: contain;">
                <div class="featured-overlay">
                    <h3>${mediaItem.title}</h3>
                    <p>${mediaItem.medium}, ${mediaItem.dimensions}, ${mediaItem.year}</p>
                </div>
            </div>
        `;
    }
}

function isLocalVideo(url) {
    // Check if URL ends with common video file extensions
    return /\.(mp4|webm|ogg|avi|mov|wmv|flv|m4v)$/i.test(url);
}

function populateGalleryItem(mediaItem, galleryGrid) {
    if (!galleryGrid) return;

    const item = document.createElement('div');
    item.className = 'gallery-item';

    if (mediaItem.type === 'image') {
        const img = document.createElement('img');
        img.src = mediaItem.url;
        img.alt = mediaItem.title;
        img.loading = 'lazy';

        const overlay = document.createElement('div');
        overlay.className = 'overlay';

        const h3 = document.createElement('h3');
        h3.textContent = mediaItem.title;

        const p = document.createElement('p');
        p.textContent = `${mediaItem.medium}, ${mediaItem.dimensions}, ${mediaItem.year}`;

        overlay.appendChild(h3);
        overlay.appendChild(p);

        item.appendChild(img);
        item.appendChild(overlay);
    } else if (mediaItem.type === 'video') {
        if (isLocalVideo(mediaItem.url)) {
            // Local video file
            item.innerHTML = `
                <video controls style="width: 100%; height: 250px; object-fit: cover;">
                    <source src="${mediaItem.url}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
                <div class="overlay">
                    <h3>${mediaItem.title}</h3>
                    <p>${mediaItem.description}</p>
                </div>
            `;
        } else {
            // Embed URL (YouTube, etc.)
            item.innerHTML = `
                <div class="embed-container-small">
                    <iframe src="${mediaItem.url}" title="${mediaItem.title}" allowfullscreen></iframe>
                </div>
                <div class="overlay">
                    <h3>${mediaItem.title}</h3>
                    <p>${mediaItem.description}</p>
                </div>
            `;
        }
    } else if (mediaItem.type === 'render3d') {
        // For renders in gallery grid, create an iframe container
        item.innerHTML = `
            <div class="embed-container-small">
                <iframe src="${mediaItem.url}" title="${mediaItem.title}" allowfullscreen></iframe>
            </div>
            <div class="overlay">
                <h3>${mediaItem.title}</h3>
                <p>${mediaItem.description}</p>
            </div>
        `;
    }

    galleryGrid.appendChild(item);

    // Add click handler to open modal
    item.addEventListener('click', () => openModal(mediaItem));
}

// Modal functionality
let currentMediaIndex = -1;
let currentMediaArray = [];

function initModal() {
    const modal = document.getElementById('media-modal');
    const modalClose = document.querySelector('.modal-close');
    const modalPrev = document.querySelector('.modal-prev');
    const modalNext = document.querySelector('.modal-next');
    const modalMediaContainer = document.querySelector('.modal-media-container');

    if (!modal || !modalClose || !modalMediaContainer) return;

    // Close modal when clicking the close button
    modalClose.addEventListener('click', closeModal);

    // Close modal when clicking outside the content
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Navigation arrows
    if (modalPrev) {
        modalPrev.addEventListener('click', showPrevMedia);
    }
    if (modalNext) {
        modalNext.addEventListener('click', showNextMedia);
    }

    // Close modal on Escape key, navigate with arrow keys
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        } else if (e.key === 'ArrowLeft' && modal.style.display === 'block') {
            showPrevMedia();
        } else if (e.key === 'ArrowRight' && modal.style.display === 'block') {
            showNextMedia();
        }
    });

    function closeModal() {
        modal.style.display = 'none';
        modalMediaContainer.innerHTML = '';
        currentMediaIndex = -1;
        currentMediaArray = [];
    }
}

function showPrevMedia() {
    if (currentMediaArray.length > 0 && currentMediaIndex > 0) {
        currentMediaIndex--;
        openModal(currentMediaArray[currentMediaIndex]);
    }
}

function showNextMedia() {
    if (currentMediaArray.length > 0 && currentMediaIndex < currentMediaArray.length - 1) {
        currentMediaIndex++;
        openModal(currentMediaArray[currentMediaIndex]);
    }
}

function openModal(mediaItem) {
    const modal = document.getElementById('media-modal');
    const modalMediaContainer = document.querySelector('.modal-media-container');

    if (!modal || !modalMediaContainer) return;

    // Set current media tracking
    const galleryType = getCurrentGalleryType();
    if (galleryType && config && config.assets[galleryType]) {
        currentMediaArray = config.assets[galleryType].media;
        currentMediaIndex = currentMediaArray.findIndex(item =>
            item.url === mediaItem.url && item.title === mediaItem.title
        );
    }

    // Clear previous content
    modalMediaContainer.innerHTML = '';

    // Create media element based on type
    let mediaElement;

    if (mediaItem.type === 'image') {
        mediaElement = document.createElement('img');
        mediaElement.src = mediaItem.url;
        mediaElement.alt = mediaItem.title;
    } else if (mediaItem.type === 'video') {
        if (isLocalVideo(mediaItem.url)) {
            mediaElement = document.createElement('video');
            mediaElement.src = mediaItem.url;
            mediaElement.controls = true;
            mediaElement.autoplay = false;
        } else {
            // Embed video
            mediaElement = document.createElement('iframe');
            mediaElement.src = mediaItem.url;
            mediaElement.allowfullscreen = true;
            mediaElement.title = mediaItem.title;
        }
    } else if (mediaItem.type === 'render3d') {
        mediaElement = document.createElement('iframe');
        mediaElement.src = mediaItem.url;
        mediaElement.allowfullscreen = true;
        mediaElement.title = mediaItem.title;
    }

    if (mediaElement) {
        modalMediaContainer.appendChild(mediaElement);
        modal.style.display = 'block';
    }
}

function addGalleryItemClickHandlers() {
    // Add click handlers to gallery items
    document.addEventListener('click', function(e) {
        const galleryItem = e.target.closest('.gallery-item');
        if (galleryItem) {
            // Find the media item data from the gallery item
            const img = galleryItem.querySelector('img');
            const video = galleryItem.querySelector('video');
            const iframe = galleryItem.querySelector('iframe');

            let mediaItem = null;

            // Get current gallery type and find the corresponding media item
            const galleryType = getCurrentGalleryType();
            if (galleryType && config && config.assets[galleryType]) {
                const mediaArray = config.assets[galleryType].media;

                if (img && !video && !iframe) {
                    // Image item
                    const imgSrc = img.src.split('/').pop(); // Get filename
                    mediaItem = mediaArray.find(item => item.url.includes(imgSrc) && item.type === 'image');
                } else if (video) {
                    // Video item
                    const videoSrc = video.querySelector('source')?.src || video.src;
                    const videoFile = videoSrc.split('/').pop(); // Get filename
                    mediaItem = mediaArray.find(item => item.url.includes(videoFile) && item.type === 'video');
                } else if (iframe) {
                    // Embed item
                    const iframeSrc = iframe.src;
                    mediaItem = mediaArray.find(item => item.url === iframeSrc);
                }
            }

            if (mediaItem) {
                openModal(mediaItem);
            }
        }
    });
}

function getCurrentGalleryType() {
    // Check URL parameters first (for gallery.html)
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type');
    if (typeParam && ['paintings', 'drawings', 'sculptures'].includes(typeParam)) {
        return typeParam;
    }

    // Fallback to path-based detection for backward compatibility
    const path = window.location.pathname;
    if (path.includes('paintings')) return 'paintings';
    if (path.includes('drawings')) return 'drawings';
    if (path.includes('sculptures')) return 'sculptures';
    return null;
}



document.addEventListener('DOMContentLoaded', async function() {
    // This listener is disabled to avoid conflicts with the main listener
    return;

    // Then load config and initialize page
    await loadConfig();
    if (config) {
        // Set default page title and meta
        document.title = config.general.siteTitle;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.content = config.general.metaDescription;

        populateNavigation();
        populateFooter();

        // Page-specific initialization
        const path = window.location.pathname;
        if (path.includes('index.html') || path === '/' || path.endsWith('larkovart/')) {
            populateHero();
            populateBioPreview();
            // Populate featured works title
            const featuredTitle = document.querySelector('.gallery h2');
            if (featuredTitle) featuredTitle.textContent = config.general.featuredTitle;
            // Populate featured works (could be first few from paintings)
            const featuredGrid = document.querySelector('.gallery-grid');
            if (featuredGrid && config.assets.paintings && config.assets.paintings.images) {
                featuredGrid.innerHTML = '';
                config.assets.paintings.images.slice(0, 3).forEach(image => {
                    const item = document.createElement('div');
                    item.className = 'gallery-item';

                    const img = document.createElement('img');
                    img.src = image.url;
                    img.alt = image.title;
                    img.loading = 'lazy';

                    const overlay = document.createElement('div');
                    overlay.className = 'overlay';

                    const h3 = document.createElement('h3');
                    h3.textContent = image.title;

                    const p = document.createElement('p');
                    p.textContent = `${image.medium}, ${image.year}`;

                    overlay.appendChild(h3);
                    overlay.appendChild(p);

                    item.appendChild(img);
                    item.appendChild(overlay);

                    featuredGrid.appendChild(item);
                });
            }
        } else if (path.includes('bio.html')) {
            populateBio();
        } else if (path.includes('paintings.html')) {
            populateGallery('paintings');
        } else if (path.includes('drawings.html')) {
            populateGallery('drawings');
        } else if (path.includes('sculptures.html')) {
            populateGallery('sculptures');
        }
    }

    // Mobile Navigation Toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
    }

    // Smooth Scrolling for Navigation Links
    document.addEventListener('click', function(e) {
        if (e.target.matches('.nav-menu a[href^="#"]')) {
            e.preventDefault();

            const targetId = e.target.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 80;

                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }

            // Close mobile menu after clicking
            if (navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            }
        }
    });

    // Gallery Image Modal/Lightbox
    document.addEventListener('click', function(e) {
        if (e.target.closest('.gallery-item')) {
            const item = e.target.closest('.gallery-item');
            const img = item.querySelector('img');
            if (img) {
                openLightbox(img.src, img.alt);
            }
        }
    });

    // Intersection Observer for Animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animateElements = document.querySelectorAll('.gallery-item, .bio-content');
    animateElements.forEach(el => {
        observer.observe(el);
    });

    // Parallax Effect for Hero Section
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const hero = document.querySelector('.hero');

        if (hero) {
            hero.style.backgroundPositionY = -(scrolled * 0.5) + 'px';
        }
    });

    // Lazy Loading for Images
    const images = document.querySelectorAll('img[data-src]');

    const imageObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
});

// Lightbox Function
function openLightbox(src, alt) {
    // Create lightbox elements
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
        <div class="lightbox-content">
            <img src="${src}" alt="${alt}">
            <span class="lightbox-close">&times;</span>
        </div>
    `;

    // Add lightbox styles
    const style = document.createElement('style');
    style.textContent = `
        .lightbox {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
        }
        .lightbox-content {
            position: relative;
            max-width: 90%;
            max-height: 90%;
        }
        .lightbox-content img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }
        .lightbox-close {
            position: absolute;
            top: -40px;
            right: 0;
            color: white;
            font-size: 2rem;
            cursor: pointer;
            transition: color 0.3s;
        }
        .lightbox-close:hover {
            color: #6B8E23;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(lightbox);

    // Close lightbox functionality
    const closeBtn = lightbox.querySelector('.lightbox-close');
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(lightbox);
        document.head.removeChild(style);
    });

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            document.body.removeChild(lightbox);
            document.head.removeChild(style);
        }
    });
}

// Utility function for smooth animations
function animateOnScroll() {
    const elements = document.querySelectorAll('.animate-on-scroll');

    elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        if (rect.top < windowHeight * 0.8) {
            el.classList.add('animated');
        }
    });
}

// Throttle scroll events
let scrollTimer;
window.addEventListener('scroll', function() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(animateOnScroll, 16);
});

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    // Load header and footer
    await loadHeader();
    await loadFooter();

    // Then load config and initialize page
    await loadConfig();
    if (config) {
        // Set default page title and meta
        document.title = config.general.siteTitle;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.content = config.general.metaDescription;

        populateNavigation();
        populateFooter();

        // Page-specific initialization
        const path = window.location.pathname;
        if (path.includes('index.html') || path === '/' || path.endsWith('larkovart/')) {
            populateHero();
            populateBioPreview();
            // Populate featured works title
            const featuredTitle = document.querySelector('.gallery h2');
            if (featuredTitle) featuredTitle.textContent = config.general.featuredTitle;
            // Populate featured works (could be first few from paintings)
            const featuredGrid = document.querySelector('.gallery-grid');
            if (featuredGrid && config.assets.paintings && config.assets.paintings.images) {
                featuredGrid.innerHTML = '';
                config.assets.paintings.images.slice(0, 3).forEach(image => {
                    const item = document.createElement('div');
                    item.className = 'gallery-item';

                    const img = document.createElement('img');
                    img.src = image.url;
                    img.alt = image.title;
                    img.loading = 'lazy';

                    const overlay = document.createElement('div');
                    overlay.className = 'overlay';

                    const h3 = document.createElement('h3');
                    h3.textContent = image.title;

                    const p = document.createElement('p');
                    p.textContent = `${image.medium}, ${image.year}`;

                    overlay.appendChild(h3);
                    overlay.appendChild(p);

                    item.appendChild(img);
                    item.appendChild(overlay);

                    featuredGrid.appendChild(item);
                });
            }
        } else if (path.includes('bio.html')) {
            populateBio();
        } else if (path.includes('gallery.html') || path.includes('paintings.html') || path.includes('drawings.html') || path.includes('sculptures.html')) {
            // Handle gallery pages (both new gallery.html and legacy files)
            const galleryType = getCurrentGalleryType();
            if (galleryType) {
                populateGallery(galleryType);
                initModal();
            }
        }
    }
});