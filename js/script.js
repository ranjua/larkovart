// Modern Artist Website JavaScript

let config = null;

// Load configuration
async function loadConfig() {
    try {
        // Try fetch first (works in modern browsers with server)
        const response = await fetch('config.json');
        config = await response.json();
        console.log('Config loaded:', config);
        return config;
    } catch (error) {
        console.warn('Fetch failed, trying XMLHttpRequest for local files:', error);
        // Fallback for local files
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', 'config.json', true);
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            config = JSON.parse(xhr.responseText);
                            console.log('Config loaded via XMLHttpRequest:', config);
                            resolve(config);
                        } catch (parseError) {
                            console.error('Error parsing config JSON:', parseError);
                            reject(parseError);
                        }
                    } else {
                        console.error('Error loading config via XMLHttpRequest:', xhr.status);
                        reject(new Error('HTTP ' + xhr.status));
                    }
                }
            };
            xhr.send();
        });
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

// Get all featured media from all sections
function getFeaturedMedia() {
    if (!config || !config.assets) return [];

    const featuredMedia = [];

    // Iterate through all asset sections (paintings, drawings, sculptures, etc.)
    Object.keys(config.assets).forEach(sectionKey => {
        const section = config.assets[sectionKey];
        if (section.media && Array.isArray(section.media)) {
            section.media.forEach(media => {
                if (media.IsFeatured === true) {
                    featuredMedia.push({
                        ...media,
                        section: sectionKey
                    });
                }
            });
        }
    });

    return featuredMedia;
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

// Populate featured works carousel
// Helper function to get items per group based on viewport
function getItemsPerGroup() {
    const width = window.innerWidth;
    if (width <= 480) return 1;
    if (width <= 768) return 2;
    return 4;
}

// Helper function to get current breakpoint
function getCurrentBreakpoint() {
    const width = window.innerWidth;
    if (width <= 480) return 'mobile';
    if (width <= 768) return 'tablet';
    return 'desktop';
}

function populateFeaturedWorks() {
    const featuredGrid = document.querySelector('.gallery-grid');
    if (!featuredGrid) return;

    const featuredMedia = getFeaturedMedia();
    if (featuredMedia.length === 0) return;

    // Change grid to carousel container
    featuredGrid.className = 'featured-carousel';
    featuredGrid.innerHTML = '';

    // Create carousel container
    const carouselContainer = document.createElement('div');
    carouselContainer.className = 'carousel-container';

    // Create carousel track
    const carouselTrack = document.createElement('div');
    carouselTrack.className = 'carousel-track';

    // Display all items in a single line (no groups)
    const groupElement = document.createElement('div');
    groupElement.className = 'carousel-group';

    featuredMedia.forEach((media, mediaIndex) => {
        const item = document.createElement('div');
        item.className = 'carousel-item';
        item.setAttribute('data-index', mediaIndex);

        if (media.type === 'image') {
            const img = document.createElement('img');
            img.src = media.url;
            img.alt = media.title;
            img.loading = 'lazy';
            item.appendChild(img);
        } else if (media.type === 'video') {
            // Handle video items
            if (media.url.includes('youtube.com') || media.url.includes('youtu.be')) {
                const iframe = document.createElement('iframe');
                iframe.src = media.url;
                iframe.frameBorder = '0';
                iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
                iframe.allowFullscreen = true;
                iframe.loading = 'lazy';
                item.appendChild(iframe);
            } else {
                const video = document.createElement('video');
                video.src = media.url;
                video.controls = true;
                video.preload = 'metadata';
                item.appendChild(video);
            }
        }

        // Add overlay with info
        const overlay = document.createElement('div');
        overlay.className = 'carousel-overlay';

        const h3 = document.createElement('h3');
        h3.textContent = media.title;

        const status = document.createElement('div');
        status.className = `item-status ${media.sold ? 'sold' : 'available'}`;
        status.textContent = media.sold ? 'Sold' : 'Available';

        const p = document.createElement('p');
        if (media.medium && media.year) {
            p.textContent = `${media.medium}, ${media.year}`;
        } else if (media.description) {
            p.textContent = media.description;
        }

        overlay.appendChild(h3);
        overlay.appendChild(status);
        overlay.appendChild(p);
        item.appendChild(overlay);

        groupElement.appendChild(item);
    });

    carouselTrack.appendChild(groupElement);

    carouselContainer.appendChild(carouselTrack);

    // Add navigation buttons
    const prevButton = document.createElement('button');
    prevButton.className = 'carousel-nav carousel-prev';
    prevButton.innerHTML = '&#10094;';
    prevButton.setAttribute('aria-label', 'Previous');

    const nextButton = document.createElement('button');
    nextButton.className = 'carousel-nav carousel-next';
    nextButton.innerHTML = '&#10095;';
    nextButton.setAttribute('aria-label', 'Next');

    carouselContainer.appendChild(prevButton);
    carouselContainer.appendChild(nextButton);

    // Remove indicators since we're not using groups anymore
    // Add indicators based on number of items
    const indicators = document.createElement('div');
    indicators.className = 'carousel-indicators';

    for (let i = 0; i < featuredMedia.length; i++) {
        const indicator = document.createElement('button');
        indicator.className = 'carousel-indicator';
        if (i === 0) indicator.classList.add('active');
        indicator.setAttribute('data-slide', i);
        indicators.appendChild(indicator);
    }

    carouselContainer.appendChild(indicators);

    featuredGrid.appendChild(carouselContainer);

    // Initialize carousel functionality
    initializeCarousel(featuredGrid, featuredMedia.length);
}

// Initialize carousel functionality
function initializeCarousel(carouselElement, totalItems) {
    const track = carouselElement.querySelector('.carousel-track');
    const items = carouselElement.querySelectorAll('.carousel-item');
    const prevBtn = carouselElement.querySelector('.carousel-prev');
    const nextBtn = carouselElement.querySelector('.carousel-next');
    const indicators = carouselElement.querySelectorAll('.carousel-indicator');
    const container = carouselElement.querySelector('.carousel-container');

    if (!track || items.length === 0) return;

    let currentIndex = 0;
    let currentOffset = 0;

    function updateCarousel() {
        // Smooth transition
        track.style.transition = 'transform 0.5s ease-in-out';
        track.style.transform = `translateX(${currentOffset}px)`;

        // Update indicators
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === currentIndex);
        });

        // Update navigation button states
        if (prevBtn) {
            prevBtn.disabled = currentIndex === 0;
            prevBtn.style.opacity = currentIndex === 0 ? '0.5' : '1';
        }
        if (nextBtn) {
            nextBtn.disabled = currentIndex === items.length - 1;
            nextBtn.style.opacity = currentIndex === items.length - 1 ? '0.5' : '1';
        }
    }

    function nextSlide() {
        if (currentIndex < items.length - 1) {
            const currentItem = items[currentIndex];
            const gap = 4; // 0.25rem gap in pixels (approximate)

            // Move by the width of the current item plus gap
            const itemWidth = currentItem.offsetWidth;
            currentOffset -= (itemWidth + gap);
            currentIndex++;
            updateCarousel();
        }
    }

    function prevSlide() {
        if (currentIndex > 0) {
            currentIndex--;
            const prevItem = items[currentIndex];
            const gap = 4; // 0.25rem gap in pixels (approximate)

            // Move back by the width of the previous item plus gap
            const itemWidth = prevItem.offsetWidth;
            currentOffset += (itemWidth + gap);
            updateCarousel();
        }
    }

    function goToSlide(index) {
        if (index === currentIndex) return;

        // Calculate cumulative offset to target index
        let newOffset = 0;
        const gap = 4;

        if (index > currentIndex) {
            // Moving forward
            for (let i = currentIndex; i < index; i++) {
                newOffset -= (items[i].offsetWidth + gap);
            }
        } else {
            // Moving backward
            for (let i = currentIndex - 1; i >= index; i--) {
                newOffset += (items[i].offsetWidth + gap);
            }
        }

        currentOffset += newOffset;
        currentIndex = index;
        updateCarousel();
    }

    // Event listeners
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);

    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => goToSlide(index));
    });

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Reset position on resize
            currentOffset = 0;
            currentIndex = 0;
            updateCarousel();
        }, 250);
    });

    // Wait for images to load before initializing
    const images = carouselElement.querySelectorAll('img');
    let loadedImages = 0;
    const totalImages = images.length;

    function checkAllImagesLoaded() {
        loadedImages++;
        if (loadedImages === totalImages) {
            setTimeout(() => updateCarousel(), 100);
        }
    }

    if (totalImages > 0) {
        images.forEach(img => {
            if (img.complete) {
                checkAllImagesLoaded();
            } else {
                img.addEventListener('load', checkAllImagesLoaded);
                img.addEventListener('error', checkAllImagesLoaded);
            }
        });
    } else {
        updateCarousel();
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
        ctaButton.href = config.pages.bio.ctaUrl;
        ctaButton.className = 'cta-button';
        ctaButton.textContent = config.pages.bio.ctaText;
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
    const galleryGrid = gallery.querySelector('.gallery-grid');

    if (galleryGrid) galleryGrid.innerHTML = '';

    // Populate media array - all items as gallery items (same size)
    if (galleryData.media && galleryData.media.length > 0) {
        galleryData.media.forEach(mediaItem => {
            populateGalleryItem(mediaItem, galleryGrid);
        });
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

        const status = document.createElement('div');
        status.className = `item-status ${mediaItem.sold ? 'sold' : 'available'}`;
        status.textContent = mediaItem.sold ? 'Sold' : 'Available';

        const p = document.createElement('p');
        p.textContent = `${mediaItem.medium}, ${mediaItem.dimensions}, ${mediaItem.year}`;

        overlay.appendChild(h3);
        overlay.appendChild(status);
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
    const modalData = document.querySelector('.modal-data');

    if (!modal || !modalMediaContainer || !modalData) return;

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
    modalData.innerHTML = '';

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

        // Add data information
        const dataHTML = `
            <div class="modal-data-content">
                <h2 class="modal-title">${mediaItem.title}</h2>
                <div class="modal-status ${mediaItem.sold ? 'sold' : 'available'}">${mediaItem.sold ? 'Sold' : 'Available'}</div>
                <div class="modal-details">
                    ${mediaItem.medium ? `<span class="modal-medium">${mediaItem.medium}</span>` : ''}
                    ${mediaItem.dimensions ? `<span class="modal-dimensions">${mediaItem.dimensions}</span>` : ''}
                    ${mediaItem.year ? `<span class="modal-year">${mediaItem.year}</span>` : ''}
                </div>
                ${mediaItem.description ? `<p class="modal-description">${mediaItem.description}</p>` : ''}
            </div>
        `;
        modalData.innerHTML = dataHTML;

        modal.style.display = 'block';
    }
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
    // Load config and initialize page
    await loadConfig();
    if (config) {
        // Set default page title and meta
        document.title = config.general.siteTitle;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.content = config.general.metaDescription;

        populateNavigation();
        populateFooter();

        // Setup mobile navigation after navigation is populated
        setupHamburgerToggle();

        // Page-specific initialization
        const path = window.location.pathname;
        const isIndexPage = path.includes('index') || path === '/' || path.endsWith('larkovart/') ||
                           (!path.includes('gallery') && !path.includes('bio') && !path.includes('.html'));

        if (isIndexPage) {
            populateHero();
            populateBioPreview();
            // Populate featured works title
            const featuredTitle = document.querySelector('.gallery h2');
            if (featuredTitle) featuredTitle.textContent = config.general.featuredTitle;
            // Populate featured works carousel
            populateFeaturedWorks();

            // Handle responsive carousel re-grouping on window resize
            let lastBreakpoint = getCurrentBreakpoint();
            window.addEventListener('resize', () => {
                const currentBreakpoint = getCurrentBreakpoint();
                if (currentBreakpoint !== lastBreakpoint) {
                    lastBreakpoint = currentBreakpoint;
                    populateFeaturedWorks();
                }
            });
        } else if (path.includes('bio')) {
            populateBio();
        } else if (path.includes('gallery')) {
            // Handle gallery pages (both new gallery.html and legacy files)
            const galleryType = getCurrentGalleryType();
            if (galleryType) {
                populateGallery(galleryType);
                initModal();
            }
        }
    }
});

// Setup mobile navigation toggle
function setupHamburgerToggle() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
    }
}

// Artistic Background Generator - Mathematical Marbling (Based on The Coding Train Challenge #183)
class ArtisticBackground {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.time = 0;
        this.animationId = null;

        // Marbling parameters based on the challenge
        this.inkDrops = [];
        this.waveFrequency = 0.01;
        this.amplitude = 30;
        this.colors = [
            [25, 50, 80, 0.8],   // Deep blue
            [50, 80, 110, 0.7],  // Medium blue
            [70, 110, 140, 0.6], // Light blue
            [90, 130, 160, 0.5], // Pale blue
            [30, 60, 90, 0.9],   // Dark cyan
            [60, 100, 130, 0.8]  // Cyan
        ];

        this.init();
    }

    init() {
        this.resizeCanvas();
        this.createInkDrops();
        this.generateMarbling();
        this.animate();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width || 800;
        this.canvas.height = rect.height || 400;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    createInkDrops() {
        // Create ink drops similar to the challenge implementation
        this.inkDrops = [];

        // Add central drops
        for (let i = 0; i < 4; i++) {
            this.inkDrops.push({
                x: this.width * 0.3 + Math.random() * this.width * 0.4,
                y: this.height * 0.3 + Math.random() * this.height * 0.4,
                radius: 20 + Math.random() * 40,
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                phase: Math.random() * Math.PI * 2
            });
        }

        // Add corner and edge drops (same properties as central drops)
        const cornerPositions = [
            // Top-left corner
            { x: this.width * 0.1 + Math.random() * this.width * 0.2, y: this.height * 0.1 + Math.random() * this.height * 0.2 },
            // Top-right corner
            { x: this.width * 0.7 + Math.random() * this.width * 0.2, y: this.height * 0.1 + Math.random() * this.height * 0.2 },
            // Bottom-left corner
            { x: this.width * 0.1 + Math.random() * this.width * 0.2, y: this.height * 0.7 + Math.random() * this.height * 0.2 },
            // Bottom-right corner
            { x: this.width * 0.7 + Math.random() * this.width * 0.2, y: this.height * 0.7 + Math.random() * this.height * 0.2 },
            // Left edge (middle)
            { x: this.width * 0.05 + Math.random() * this.width * 0.15, y: this.height * 0.4 + Math.random() * this.height * 0.2 },
            // Right edge (middle)
            { x: this.width * 0.8 + Math.random() * this.width * 0.15, y: this.height * 0.4 + Math.random() * this.height * 0.2 },
            // Top edge (middle)
            { x: this.width * 0.4 + Math.random() * this.width * 0.2, y: this.height * 0.05 + Math.random() * this.height * 0.15 },
            // Bottom edge (middle)
            { x: this.width * 0.4 + Math.random() * this.width * 0.2, y: this.height * 0.8 + Math.random() * this.height * 0.15 }
        ];

        for (let pos of cornerPositions) {
            this.inkDrops.push({
                x: pos.x,
                y: pos.y,
                radius: 20 + Math.random() * 40,
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                phase: Math.random() * Math.PI * 2
            });
        }

        // Add scattered drops
        for (let i = 0; i < 6; i++) {
            this.inkDrops.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: 10 + Math.random() * 30,
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    generateMarbling() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Create base gradient
        this.drawBaseGradient();

        // Draw the marbling pattern using mathematical functions
        this.drawMarblingPattern();
    }

    drawBaseGradient() {
        const gradient = this.ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, 'rgba(10, 25, 40, 0.1)');
        gradient.addColorStop(0.5, 'rgba(20, 45, 70, 0.05)');
        gradient.addColorStop(1, 'rgba(15, 35, 55, 0.1)');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawMarblingPattern() {
        const imageData = this.ctx.createImageData(this.width, this.height);
        const data = imageData.data;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const pixelIndex = (y * this.width + x) * 4;

                // Calculate the marbling effect for this pixel
                const color = this.calculateMarblingColor(x, y);

                data[pixelIndex] = color.r;     // Red
                data[pixelIndex + 1] = color.g; // Green
                data[pixelIndex + 2] = color.b; // Blue
                data[pixelIndex + 3] = color.a; // Alpha
            }
        }

        this.ctx.putImageData(imageData, 0, 0);
    }

    calculateMarblingColor(x, y) {
        let totalInfluence = 0;
        let r = 0, g = 0, b = 0, a = 0;

        // Calculate influence from each ink drop
        for (const drop of this.inkDrops) {
            const dx = x - drop.x;
            const dy = y - drop.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < drop.radius * 2) {
                // Calculate wave-based influence (mathematical marbling core)
                const normalizedDistance = distance / (drop.radius * 5);
                const waveEffect = Math.sin(normalizedDistance * Math.PI * 4 + this.time * 0.01 + drop.phase) * 0.5 + 0.5;

                // Add turbulence for more organic look
                const turbulence = Math.sin(x * this.waveFrequency + this.time * 0.005) *
                                 Math.cos(y * this.waveFrequency * 0.7 + this.time * 0.007) * 0.03;

                const influence = (1 - normalizedDistance) * (waveEffect + turbulence + 5);

                if (influence > 0) {
                    r += drop.color[0] * influence * drop.color[3];
                    g += drop.color[1] * influence * drop.color[3];
                    b += drop.color[2] * influence * drop.color[3];
                    a += influence * drop.color[3];
                    totalInfluence += influence;
                }
            }
        }

        // Normalize colors
        if (totalInfluence > 0) {
            r = Math.min(255, r / totalInfluence);
            g = Math.min(255, g / totalInfluence);
            b = Math.min(255, b / totalInfluence);
            a = Math.min(255, (a / totalInfluence) * 200); // Scale alpha for subtlety
        } else {
            // Background color for areas with no influence
            r = 15 + Math.sin(x * 0.01 + y * 0.01) * 5;
            g = 30 + Math.cos(x * 0.008 + y * 0.012) * 8;
            b = 45 + Math.sin(x * 0.006 + y * 0.009) * 6;
            a = 20;
        }

        return { r: Math.floor(r), g: Math.floor(g), b: Math.floor(b), a: Math.floor(a) };
    }

    animate() {
        this.time += 1;

        // Regenerate marbling every 45 frames for smooth animation
        if (this.time % 45 === 0) {
            this.generateMarbling();
        }

        // Occasionally add new ink drops for dynamic effect
        if (this.time % 300 === 0) {
            this.addRandomInkDrop();
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    addRandomInkDrop() {
        this.inkDrops.push({
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            radius: 15 + Math.random() * 25,
            color: this.colors[Math.floor(Math.random() * this.colors.length)],
            phase: Math.random() * Math.PI * 2
        });

        // Limit the number of drops to prevent performance issues
        if (this.inkDrops.length > 50) {
            this.inkDrops.shift();
        }
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        window.removeEventListener('resize', () => this.resizeCanvas());
    }
}

// Initialize artistic background when DOM is loaded
let artisticBackground;
document.addEventListener('DOMContentLoaded', function() {
    const heroCanvas = document.getElementById('hero-canvas');
    if (heroCanvas) {
        artisticBackground = new ArtisticBackground(heroCanvas);
    }
});

// Fallback initialization after page load
window.addEventListener('load', function() {
    if (!artisticBackground) {
        const heroCanvas = document.getElementById('hero-canvas');
        if (heroCanvas) {
            artisticBackground = new ArtisticBackground(heroCanvas);
        }
    }
});