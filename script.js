(function() {
    'use strict';

    // STATE
    let events = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let isExpanded = false;
    const INITIAL_DISPLAY = 6;
    const ADMIN_PASSWORD = 'admin123';

    // DOM REFS
    const eventsContainer = document.getElementById('eventsContainer');
    const emptyState = document.getElementById('emptyState');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const filterSelect = document.getElementById('filterSelect');
    const eventForm = document.getElementById('eventForm');
    const eventCount = document.getElementById('eventCount');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    const togglePassword = document.getElementById('togglePassword');
    
    const titleInput = document.getElementById('eventTitle');
    const venueInput = document.getElementById('eventVenue');
    const categorySelect = document.getElementById('eventCategory');
    const dateInput = document.getElementById('eventDate');
    const timeInput = document.getElementById('eventTime');
    const descriptionInput = document.getElementById('eventDescription');
    const passwordInput = document.getElementById('eventPassword');
    const charCount = document.getElementById('charCount');
    const formSuccess = document.getElementById('formSuccess');

    const titleError = document.getElementById('titleError');
    const venueError = document.getElementById('venueError');
    const categoryError = document.getElementById('categoryError');
    const dateError = document.getElementById('dateError');
    const timeError = document.getElementById('timeError');
    const passwordError = document.getElementById('passwordError');

    // CATEGORY DATA
    const categoryIcons = {
        reading: 'fa-book-open',
        launch: 'fa-rocket',
        meet: 'fa-handshake',
        club: 'fa-users',
        poetry: 'fa-feather-alt',
        storytelling: 'fa-microphone-alt',
        speech: 'fa-chalkboard-teacher',
        other: 'fa-calendar-plus'
    };

    const categoryColors = {
        reading: '#4A90D9',
        launch: '#E67E22',
        meet: '#27AE60',
        club: '#8E44AD',
        poetry: '#E74C3C',
        storytelling: '#F39C12',
        speech: '#2ECC71',
        other: '#95A5A6'
    };

    // HAMBURGER
    hamburger.addEventListener('click', function() {
        this.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });

    // PASSWORD TOGGLE
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.querySelector('i').classList.toggle('fa-eye');
        this.querySelector('i').classList.toggle('fa-eye-slash');
    });

    // SANITIZE
    function sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        const temp = document.createElement('div');
        temp.textContent = input;
        return temp.innerHTML;
    }

    // LOADING
    function showLoading() {
        loadingIndicator.classList.remove('loading-hidden');
        loadingIndicator.classList.add('loading-visible');
        eventsContainer.innerHTML = '';
        emptyState.classList.add('hidden');
        // Hide explore button during loading
        const btn = document.getElementById('exploreBtn');
        if (btn) btn.style.display = 'none';
    }

    function hideLoading() {
        loadingIndicator.classList.add('loading-hidden');
        loadingIndicator.classList.remove('loading-visible');
    }

    // FILTER
    function getFilteredEvents() {
        let filtered = [...events];
        if (currentFilter !== 'all') {
            filtered = filtered.filter(event => event.category === currentFilter);
        }
        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            filtered = filtered.filter(event => 
                event.title.toLowerCase().includes(query) ||
                event.venue.toLowerCase().includes(query)
            );
        }
        return filtered;
    }

    // FORMAT DATE
    function formatDate(dateString) {
        if (!dateString) return 'TBD';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function getCategoryLabel(category) {
        const labels = {
            reading: 'Book Reading',
            launch: 'Book Launch',
            meet: 'Author Meet & Signing',
            club: 'Book Club Meeting',
            poetry: 'Poetry',
            storytelling: 'Storytelling Session',
            speech: 'Speech',
            other: 'Other'
        };
        return labels[category] || category;
    }

    // RENDER EVENTS
    function renderEvents() {
        showLoading();
        setTimeout(() => {
            const filtered = getFilteredEvents();
            hideLoading();
            eventCount.textContent = `${filtered.length} event${filtered.length !== 1 ? 's' : ''}`;

            if (filtered.length === 0) {
                eventsContainer.innerHTML = '';
                emptyState.classList.remove('hidden');
                const btn = document.getElementById('exploreBtn');
                if (btn) btn.style.display = 'none';
                return;
            }

            emptyState.classList.add('hidden');
            const displayCount = isExpanded ? filtered.length : Math.min(filtered.length, INITIAL_DISPLAY);
            const visibleEvents = filtered.slice(0, displayCount);

            eventsContainer.innerHTML = visibleEvents.map((event) => {
                const icon = categoryIcons[event.category] || 'fa-calendar';
                const color = categoryColors[event.category] || '#95A5A6';
                const categoryLabel = getCategoryLabel(event.category);
                
                return `
                    <div class="event-card" data-id="${event.id}">
                        <div class="card-header">
                            <div class="card-icon-wrapper" style="background: ${color}20; color: ${color};">
                                <i class="fas ${icon}"></i>
                            </div>
                            <div class="card-title-group">
                                <span class="badge">${categoryLabel}</span>
                                <h3>${sanitizeInput(event.title)}</h3>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="detail"><i class="fas fa-map-marker-alt"></i> ${sanitizeInput(event.venue)}</div>
                            <div class="detail"><i class="fas fa-calendar-day"></i> ${formatDate(event.date)}</div>
                            <div class="detail"><i class="fas fa-clock"></i> ${event.time || 'TBD'}</div>
                            ${event.description ? `<p class="description">${sanitizeInput(event.description)}</p>` : ''}
                        </div>
                        <div class="card-footer">
                            <button class="participate-btn" data-id="${event.id}"><i class="fas fa-ticket-alt"></i> Participate</button>
                            <button class="delete-btn" data-id="${event.id}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }).join('');

            document.querySelectorAll('.participate-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = parseInt(this.getAttribute('data-id'));
                    participateEvent(id);
                });
            });

            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = parseInt(this.getAttribute('data-id'));
                    deleteEvent(id);
                });
            });

            const btn = document.getElementById('exploreBtn');
            const hasMoreEvents = filtered.length > INITIAL_DISPLAY;
            if (hasMoreEvents && btn) {
                btn.style.display = 'inline-flex';
                if (isExpanded) {
                    btn.classList.add('expanded');
                    btn.querySelector('.explore-text').textContent = 'Show Less';
                } else {
                    btn.classList.remove('expanded');
                    btn.querySelector('.explore-text').textContent = 'Explore More Events';
                }
            } else if (btn) {
                btn.style.display = 'none';
            }
        }, 600);
    }

     // EXPLORE MORE BUTTON
    const exploreBtnElement = document.getElementById('exploreBtn');
    
    if (exploreBtnElement) {
        // Remove existing listeners by cloning
        const newExploreBtn = exploreBtnElement.cloneNode(true);
        exploreBtnElement.parentNode.replaceChild(newExploreBtn, exploreBtnElement);
        
        // Get fresh reference
        const freshExploreBtn = document.getElementById('exploreBtn');
        
        // Add click event with maximum prevention
        freshExploreBtn.addEventListener('click', function(e) {
            // Prevent all default behaviors
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Toggle state
            isExpanded = !isExpanded;
            this.classList.toggle('expanded');
            
            // Update text
            const textSpan = this.querySelector('.explore-text');
            textSpan.textContent = isExpanded ? 'Show Less' : 'Explore More Events';
            
            // Render events
            renderEvents();
            
            // Keep user at events section (prevent jump to form)
            const eventsSection = document.getElementById('events-section');
            if (eventsSection) {
                // Only scroll if needed, but prevent any jump to #add-event
                const currentScroll = window.scrollY;
                // If we are at the top or near, stay
                if (currentScroll < 100) {
                    window.scrollTo({
                        top: eventsSection.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            }
            
            // Return false for extra safety
            return false;
        });
        
        // Extra prevention for mousedown and touchstart
        freshExploreBtn.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        });
        
        freshExploreBtn.addEventListener('touchstart', function(e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        });
    }

    // PARTICIPATE
    function participateEvent(id) {
        const event = events.find(e => e.id === id);
        if (event) {
            alert(`🎉 You've registered to participate in:\n\n"${event.title}"\n📍 ${event.venue}\n📅 ${formatDate(event.date)}`);
        }
    }

    // DELETE
    function deleteEvent(id) {
        if (confirm('Are you sure you want to delete this event?')) {
            events = events.filter(event => event.id !== id);
            renderEvents();
        }
    }

    // ADD EVENT
    function addEvent(eventData) {
        const newEvent = {
            id: Date.now(),
            title: sanitizeInput(eventData.title),
            venue: sanitizeInput(eventData.venue),
            category: sanitizeInput(eventData.category),
            date: sanitizeInput(eventData.date),
            time: sanitizeInput(eventData.time || ''),
            description: sanitizeInput(eventData.description || '')
        };
        events.push(newEvent);
        renderEvents();
        showSuccessMessage();
        resetForm();
    }

    function showSuccessMessage() {
        formSuccess.classList.remove('hidden');
        setTimeout(() => { formSuccess.classList.add('hidden'); }, 5000);
    }

    function resetForm() {
        eventForm.reset();
        document.querySelectorAll('.form-group').forEach(group => group.classList.remove('error'));
        titleError.textContent = '';
        venueError.textContent = '';
        categoryError.textContent = '';
        dateError.textContent = '';
        timeError.textContent = '';
        passwordError.textContent = '';
        charCount.textContent = '0 / 300';
        formSuccess.classList.add('hidden');
    }

    // VALIDATE
    function validateForm() {
        let isValid = true;
        document.querySelectorAll('.form-group').forEach(group => group.classList.remove('error'));
        titleError.textContent = '';
        venueError.textContent = '';
        categoryError.textContent = '';
        dateError.textContent = '';
        timeError.textContent = '';
        passwordError.textContent = '';

        if (!titleInput.value.trim()) {
            titleError.textContent = 'Event title is required.';
            titleInput.closest('.form-group').classList.add('error');
            isValid = false;
        }

        if (!venueInput.value.trim()) {
            venueError.textContent = 'Venue is required.';
            venueInput.closest('.form-group').classList.add('error');
            isValid = false;
        }

        if (!categorySelect.value) {
            categoryError.textContent = 'Please select a category.';
            categorySelect.closest('.form-group').classList.add('error');
            isValid = false;
        }

        if (!dateInput.value) {
            dateError.textContent = 'Please select a date.';
            dateInput.closest('.form-group').classList.add('error');
            isValid = false;
        }

        if (!timeInput.value) {
            timeError.textContent = 'Please select a time.';
            timeInput.closest('.form-group').classList.add('error');
            isValid = false;
        }

        if (!passwordInput.value) {
            passwordError.textContent = 'Admin password is required.';
            passwordInput.closest('.form-group').classList.add('error');
            isValid = false;
        } else if (passwordInput.value !== ADMIN_PASSWORD) {
            passwordError.textContent = 'Incorrect password.';
            passwordInput.closest('.form-group').classList.add('error');
            isValid = false;
        }

        return isValid;
    }

    // CHARACTER COUNTER
    descriptionInput.addEventListener('input', function() {
        const count = this.value.length;
        charCount.textContent = `${count} / 300`;
        if (count > 300) {
            this.value = this.value.substring(0, 300);
            charCount.textContent = '300 / 300';
        }
    });

    // SEARCH
    searchBtn.addEventListener('click', function() {
        searchQuery = searchInput.value;
        isExpanded = false;
        renderEvents();
    });

    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchBtn.click();
    });

    // FILTER
    filterSelect.addEventListener('change', function() {
        currentFilter = this.value;
        isExpanded = false;
        renderEvents();
    });

    // FORM SUBMIT
    eventForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (validateForm()) {
            const eventData = {
                title: titleInput.value.trim(),
                venue: venueInput.value.trim(),
                category: categorySelect.value,
                date: dateInput.value,
                time: timeInput.value,
                description: descriptionInput.value.trim()
            };
            addEvent(eventData);
        }
    });

    // RESET BUTTON
    document.getElementById('resetBtn').addEventListener('click', function() {
        resetForm();
    });

    // SAMPLE DATA
    function initializeSampleData() {
        const sampleEvents = [
            { id: 1, title: 'Book Launch: "The Lost Chapter"', venue: 'The Book Nook, 123 Main St, NYC', category: 'launch', date: '2026-08-15', time: '6:00 PM', description: 'Join us for the launch of debut author Sarah Mitchell\'s new novel.' },
            { id: 2, title: 'Author Meet & Signing with Michael Chen', venue: 'Pages Bookstore, 456 Oak Ave, LA', category: 'meet', date: '2026-08-20', time: '2:00 PM', description: 'Meet bestselling author Michael Chen.' },
            { id: 3, title: 'Monthly Book Club Meeting', venue: 'The Writers Block, 789 Pine St, SF', category: 'club', date: '2026-08-25', time: '7:30 PM', description: 'This month: "Dune" by Frank Herbert.' },
            { id: 4, title: 'Poetry Open Mic Night', venue: 'The Poetry House, 321 Verse Ln, Chicago', category: 'poetry', date: '2026-08-28', time: '8:00 PM', description: 'Share your original poetry.' },
            { id: 5, title: 'Storytelling Session: Local Legends', venue: 'Community Library, 555 Story Rd, Boston', category: 'storytelling', date: '2026-09-01', time: '4:00 PM', description: 'A special storytelling session.' },
            { id: 6, title: 'Book Reading: "Hidden Gems"', venue: 'The Book Nook, 123 Main St, NYC', category: 'reading', date: '2026-09-05', time: '5:30 PM', description: 'Author Jane Doe reads from her latest collection.' },
            { id: 7, title: 'Speech: The Future of Independent Publishing', venue: 'The Writers Block, 789 Pine St, SF', category: 'speech', date: '2026-09-10', time: '10:00 AM', description: 'Industry expert David Miller discusses the future.' }
        ];
        events = sampleEvents;
        renderEvents();
    }

    initializeSampleData();

})();