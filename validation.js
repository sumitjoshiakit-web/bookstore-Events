(() => {
    const get = id => document.getElementById(id);
    const fields = {
        title: get('eventTitle'), venue: get('eventVenue'), sd: get('eventStartDate'), st: get('eventStartTime'),
        ed: get('eventEndDate'), et: get('eventEndTime'), cat: get('eventCategory'), desc: get('eventDescription'),
        featured: get('eventFeatured'), guest: get('featuredPersonName'), role: get('featuredPersonRole'), password: get('adminPassword')
    };
    const errorIds = { title: 'titleError', venue: 'venueError', sd: 'sdError', st: 'stError', ed: 'edError', et: 'etError', cat: 'catError', desc: 'descError', guest: 'guestError', role: 'roleError', password: 'passwordError' };
    const clean = value => typeof value === 'string' ? value.trim().replace(/\0/g, '') : '';

    function clearValidation() {
        Object.values(fields).forEach(field => {
            if (!field || field.type === 'checkbox') return;
            field.classList.remove('error');
            field.removeAttribute('aria-invalid');
        });
        Object.values(errorIds).forEach(id => { const element = get(id); if (element) element.textContent = ''; });
    }

    function validate() {
        const errors = [];
        const add = (field, message) => errors.push({ field, message });
        const data = {
            title: clean(fields.title.value), venue: clean(fields.venue.value), sd: fields.sd.value, st: fields.st.value,
            ed: fields.ed.value, et: fields.et.value, cat: fields.cat.value, desc: clean(fields.desc.value),
            featured: fields.featured.checked, guest: clean(fields.guest.value), role: clean(fields.role.value), password: clean(fields.password.value)
        };
        if (data.title.length < 2 || data.title.length > 100) add('title', 'Enter an event title between 2 and 100 characters.');
        if (data.venue.length < 2 || data.venue.length > 100) add('venue', 'Enter a venue between 2 and 100 characters.');
        if (!data.sd) add('sd', 'Select the event start date.');
        if (!data.st) add('st', 'Select the event start time.');
        if (!data.ed) add('ed', 'Select the event end date.');
        if (!data.et) add('et', 'Select the event end time.');
        if (data.sd && data.st && data.ed && data.et) {
            const start = new Date(`${data.sd}T${data.st}`);
            const end = new Date(`${data.ed}T${data.et}`);
            if (end <= start) {
                if (data.ed < data.sd) add('ed', 'End date cannot be before the start date.');
                else if (data.ed === data.sd) add('et', 'End time must be later than the start time when the event is on the same date.');
                else add('et', 'End date and time must be after the start date and time.');
            }
        }
        if (!['book-club', 'author-event', 'workshop', 'reading', 'signing'].includes(data.cat)) add('cat', 'Select an event category.');
        if (data.desc.length < 5 || data.desc.length > 500) add('desc', 'Description must be between 5 and 500 characters.');
        if (data.featured && data.guest.length < 2) add('guest', 'Enter the featured person’s name.');
        if (data.featured && data.role.length < 2) add('role', 'Enter the featured person’s role or title.');
        if (!data.password) add('password', 'Enter the admin password.');
        return errors;
    }

    function showErrors(errors) {
        errors.forEach(({ field, message }) => {
            const input = fields[field];
            const error = get(errorIds[field]);
            if (input) { input.classList.add('error'); input.setAttribute('aria-invalid', 'true'); }
            if (error) error.textContent = message;
        });
        const first = errors[0]?.field;
        if (first && fields[first]) fields[first].focus();
        const toast = get('toast');
        const toastMessage = get('toastMessage');
        if (toast && toastMessage) {
            toastMessage.textContent = errors.length === 1 ? errors[0].message : `Please correct ${errors.length} highlighted fields.`;
            toast.className = 'toast error';
            toast.hidden = false;
        }
    }

    document.addEventListener('submit', event => {
        if (event.target?.id !== 'addEventForm') return;
        clearValidation();
        const errors = validate();
        if (!errors.length) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        showErrors(errors);
    }, true);

    document.addEventListener('input', event => {
        const match = Object.entries(fields).find(([, element]) => element === event.target);
        if (!match) return;
        const [field, input] = match;
        input.classList.remove('error');
        input.removeAttribute('aria-invalid');
        const error = get(errorIds[field]);
        if (error) error.textContent = '';
    });

    document.addEventListener('change', event => {
        const match = Object.entries(fields).find(([, element]) => element === event.target);
        if (!match) return;
        const [field, input] = match;
        if (input.type !== 'checkbox') { input.classList.remove('error'); input.removeAttribute('aria-invalid'); }
        const error = get(errorIds[field]);
        if (error) error.textContent = '';
    });
})();
