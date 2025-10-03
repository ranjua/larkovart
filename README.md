# Larko Art - Modern Artist Website

A modern, responsive static website for contemporary artist Larko, showcasing paintings, drawings, and sculptures with an olive green theme.

## Features

- **Modern Design**: Clean, responsive layout with olive green color scheme
- **Multiple Galleries**: Dedicated pages for paintings, drawings, and sculptures
- **Interactive Elements**: Smooth animations, hover effects, and mobile navigation
- **Media Integration**: Embedded YouTube videos and Sketchfab 3D models
- **Artist Bio**: Detailed information about the artist's background and philosophy
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

## Tech Stack

- **HTML5**: Semantic markup and modern structure
- **CSS3**: Grid/Flexbox layouts, custom properties, animations, and transitions
- **Vanilla JavaScript**: Interactive features and smooth scrolling
- **Responsive Design**: Mobile-first approach with breakpoints

## Project Structure

```
larkovart/
├── index.html          # Landing page with hero section
├── bio.html           # Artist biography and background
├── paintings.html     # Paintings gallery with 5 artworks
├── drawings.html      # Drawings gallery with 5 artworks
├── sculptures.html    # Sculptures gallery with 3 artworks
├── css/
│   └── style.css      # Main stylesheet with olive green theme
├── js/
│   └── script.js      # JavaScript for interactivity
├── images/            # Directory for artwork images
├── .gitignore         # Git ignore file
└── README.md          # This file
```

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ranjua/larkovart.git
   cd larkovart
   ```

2. **Run locally**:
   ```bash
   # Using Python (recommended)
   python -m http.server 8000

   # Or using Node.js (if available)
   npx serve .

   # Or using PHP
   php -S localhost:8000
   ```

3. **Open in browser**:
   Navigate to `http://localhost:8000` to view the website.

## Color Scheme

- **Primary**: Olive Green (#6B8E23)
- **Secondary**: Dark Olive Green (#556B2F)
- **Accent**: Golden Yellow (#DAA520)
- **Background**: Beige (#F5F5DC)
- **Text**: Dark Green (#2F4F2F)

## Features Implemented

- ✅ Responsive navigation with mobile hamburger menu
- ✅ Smooth scrolling and page transitions
- ✅ Gallery lightbox for image viewing
- ✅ Hover effects and animations
- ✅ Embedded YouTube videos in galleries
- ✅ Sketchfab 3D model embeds
- ✅ Intersection Observer for scroll animations
- ✅ Lazy loading for images
- ✅ Parallax effects on hero section

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

- Contact form integration
- Image optimization and WebP support
- Dark mode toggle
- Gallery filtering and search
- Print styles for artwork details

## License

© 2024 Larko Art. All rights reserved.
