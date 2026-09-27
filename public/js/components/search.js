let searchTimeoutId;
let searchController;

async function searchExercises(query) {
    try {
        if (searchController) {
            searchController.abort();
        }

        searchController = new AbortController();
        const language = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'pt';
        const response = await fetch(`${apiBaseUrl}/api/exercises/search?lang=${language}&query=${encodeURIComponent(query)}`, {
            signal: searchController.signal,
        });

        if (!response.ok) {
            throw new Error(`Erro na API: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.exercises && data.exercises.length > 0) {
            document.dispatchEvent(new CustomEvent('searchResults', { detail: data.exercises }));
        } else {
            console.warn('Nenhum exercicio encontrado para a pesquisa:', query);
            clearSearchResults();
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            return;
        }

        console.error('Erro ao buscar exercicios:', error);
        clearSearchResults();
    } finally {
        searchController = null;
    }
}

function clearSearchResults() {
    document.dispatchEvent(new CustomEvent('clearSearchResults'));
}

function createSearchBar() {
    const searchPlaceholder = document.getElementById('search-placeholder');

    if (!searchPlaceholder) {
        console.error('Placeholder da barra de pesquisa nao encontrado!');
        return;
    }

    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    const getSearchPlaceholder = () => {
        const language = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'pt';
        return {
            pt: 'Pesquisar exercícios...',
            en: 'Search exercises...',
            es: 'Buscar ejercicios...',
        }[language] || 'Search exercises...';
    };

    searchInput.placeholder = getSearchPlaceholder();
    searchInput.className = 'search-input';

    const searchButton = document.createElement('button');
    searchButton.type = 'button';
    searchButton.className = 'search-icon';
    searchButton.setAttribute('aria-label', 'Pesquisar');
    searchButton.innerHTML = '<i class="fas fa-search" aria-hidden="true"></i>';

    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(searchButton);
    searchPlaceholder.appendChild(searchContainer);

    const expandSearch = () => {
        searchPlaceholder.classList.add('is-search-expanded');
        searchContainer.classList.add('is-expanded');
        searchInput.focus();
    };

    const collapseSearch = () => {
        if (!searchInput.value.trim()) {
            searchPlaceholder.classList.remove('is-search-expanded');
            searchContainer.classList.remove('is-expanded');
        }
    };

    searchButton.addEventListener('click', expandSearch);
    searchInput.addEventListener('focus', expandSearch);
    searchInput.addEventListener('blur', collapseSearch);

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();

        clearTimeout(searchTimeoutId);

        if (!query) {
            if (searchController) {
                searchController.abort();
            }

            clearSearchResults();
            return;
        }

        searchTimeoutId = window.setTimeout(() => {
            searchExercises(query);
        }, 250);
    });

    document.addEventListener('languageChanged', () => {
        searchInput.value = '';
        searchInput.placeholder = getSearchPlaceholder();
        collapseSearch();
    });
}

createSearchBar();
