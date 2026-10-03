function createNavbar() {
    const navbar = document.createElement('nav');
    navbar.className = 'app-navbar navbar navbar-expand-lg fixed-top';

    const container = document.createElement('div');
    container.className = 'nav-container';

    const logo = document.createElement('a');
    logo.href = '/';
    logo.className = 'navbar-brand brand-link';

    const logoImg = document.createElement('img');
    logoImg.id = 'logo-img';
    logoImg.src = 'https://n519x3fvhoado5zf.public.blob.vercel-storage.com/avatars/69651f2b148c75323c2a9c7e/1769382801270.svg';
    logoImg.alt = 'MuscleLib';
    logoImg.className = 'logo-img';
    logo.appendChild(logoImg);

    const searchPlaceholder = document.createElement('div');
    searchPlaceholder.className = 'search-placeholder';
    searchPlaceholder.id = 'search-placeholder';

    const navActions = document.createElement('div');
    navActions.className = 'nav-actions';

    const filterToggle = document.createElement('button');
    filterToggle.id = 'toggle-filters';
    filterToggle.className = 'nav-action-btn filter-toggle';
    filterToggle.type = 'button';
    filterToggle.setAttribute('aria-expanded', 'false');
    filterToggle.setAttribute('aria-controls', 'filter-options');
    filterToggle.setAttribute('aria-label', 'Filtros');
    filterToggle.setAttribute('data-i18n-aria-label', 'filterToggle');
    filterToggle.innerHTML = '<i class="fas fa-sliders" aria-hidden="true"></i><span data-i18n="filterToggle">Filtros</span><i class="filter-toggle-icon fas fa-chevron-down" aria-hidden="true"></i>';

    const languageControl = document.createElement('label');
    languageControl.className = 'language-control nav-language';
    languageControl.setAttribute('aria-label', 'Select language');
    languageControl.setAttribute('data-i18n-aria-label', 'languageLabel');

    const languageIcon = document.createElement('i');
    languageIcon.className = 'fas fa-globe';
    languageIcon.setAttribute('aria-hidden', 'true');

    const languageSelect = document.createElement('select');
    languageSelect.id = 'language-select';
    languageSelect.className = 'filter-select form-select';
    languageSelect.setAttribute('aria-label', 'Select language');
    languageSelect.setAttribute('data-i18n-aria-label', 'languageLabel');

    const portugueseOption = document.createElement('option');
    portugueseOption.value = 'pt';
    portugueseOption.textContent = 'PT';

    const englishOption = document.createElement('option');
    englishOption.value = 'en';
    englishOption.textContent = 'EN';

    const spanishOption = document.createElement('option');
    spanishOption.value = 'es';
    spanishOption.textContent = 'ES';

    languageSelect.appendChild(portugueseOption);
    languageSelect.appendChild(englishOption);
    languageSelect.appendChild(spanishOption);
    languageControl.appendChild(languageIcon);
    languageControl.appendChild(languageSelect);

    const themeToggle = document.createElement('button');
    themeToggle.id = 'theme-toggle';
    themeToggle.className = 'nav-icon-btn';
    themeToggle.type = 'button';
    themeToggle.setAttribute('aria-label', 'Alternar tema');
    themeToggle.setAttribute('data-i18n-aria-label', 'themeLabel');

    const themeIcon = document.createElement('i');
    themeIcon.id = 'theme-icon';
    themeIcon.className = 'fas fa-sun';
    themeToggle.appendChild(themeIcon);

    navActions.appendChild(filterToggle);
    navActions.appendChild(languageControl);
    navActions.appendChild(themeToggle);

    container.appendChild(logo);
    container.appendChild(searchPlaceholder);
    container.appendChild(navActions);

    navbar.appendChild(container);
    document.body.insertBefore(navbar, document.body.firstChild);
}

createNavbar();
