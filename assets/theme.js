/* ==========================================================================
   Planet Botanica — theme.js
   Vanilla custom elements, no dependencies, no build step.
   Config (routes, strings, dispatch rules) is injected by layout/theme.liquid.
   ========================================================================== */

(() => {
  const theme = window.theme || {};
  const routes = theme.routes || {};
  const strings = theme.strings || {};

  /* ---------- Helpers ---------- */

  const define = (name, constructor) => {
    if (!customElements.get(name)) customElements.define(name, constructor);
  };

  function debounce(fn, wait) {
    let timer;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  const parseHTML = (html) => new DOMParser().parseFromString(html, 'text/html');

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const lockScroll = (lock) => document.documentElement.classList.toggle('scroll-locked', lock);

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function trapFocus(container, event) {
    const items = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === container)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ---------- Cart API + section rendering ---------- */

  const Cart = {
    // Every element marked data-render-section="<section id>" is refreshed after a cart change.
    sectionIds() {
      const ids = new Set(['cart-count']);
      document.querySelectorAll('[data-render-section]').forEach((el) => ids.add(el.dataset.renderSection));
      return [...ids].slice(0, 5);
    },

    async request(url, body) {
      const isForm = body instanceof FormData;
      const response = await fetch(url, {
        method: 'POST',
        headers: isForm
          ? { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
          : { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: isForm ? body : JSON.stringify(body),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.status) {
        throw new Error(json.description || json.message || strings.cartError);
      }
      return json;
    },

    async add(formData) {
      formData.append('sections', this.sectionIds().join(','));
      formData.append('sections_url', window.location.pathname);
      const json = await this.request(`${routes.cartAdd}.js`, formData);
      this.render(json.sections);
      document.dispatchEvent(new CustomEvent('cart:change', { detail: { source: 'add', item: json } }));
      return json;
    },

    async change(line, quantity) {
      const json = await this.request(`${routes.cartChange}.js`, {
        line,
        quantity,
        sections: this.sectionIds(),
        sections_url: window.location.pathname,
      });
      this.render(json.sections);
      document.dispatchEvent(new CustomEvent('cart:change', { detail: { source: 'change', cart: json } }));
      return json;
    },

    updateNote(note) {
      return this.request(`${routes.cartUpdate}.js`, { note });
    },

    render(sections) {
      if (!sections) return;
      Object.entries(sections).forEach(([id, html]) => {
        if (!html) return;
        const fresh = parseHTML(html).querySelector(`[data-render-section="${id}"]`);
        if (!fresh) return;
        document.querySelectorAll(`[data-render-section="${id}"]`).forEach((el) => {
          el.innerHTML = fresh.innerHTML;
        });
      });
    },
  };

  theme.cart = Cart;

  /* ---------- Header: sizes, dropdowns, menu drawer, search ---------- */

  function initHeader() {
    const wrapper = document.querySelector('.header-wrapper');
    if (!wrapper) return;

    initHeader.controller?.abort();
    initHeader.controller = new AbortController();
    const { signal } = initHeader.controller;

    const setVars = () => {
      const rect = wrapper.getBoundingClientRect();
      const root = document.documentElement.style;
      root.setProperty('--header-height', `${Math.round(wrapper.offsetHeight)}px`);
      root.setProperty('--header-bottom', `${Math.max(0, Math.round(rect.bottom))}px`);
    };
    setVars();
    if ('ResizeObserver' in window) new ResizeObserver(setVars).observe(wrapper);

    const hoverQuery = window.matchMedia('(hover: hover) and (min-width: 990px)');
    const dropdowns = [...wrapper.querySelectorAll('[data-dropdown]')];
    dropdowns.forEach((dropdown) => {
      dropdown.addEventListener('toggle', () => {
        if (dropdown.open) dropdowns.forEach((other) => other !== dropdown && (other.open = false));
      });
      dropdown.addEventListener('mouseenter', () => hoverQuery.matches && (dropdown.open = true));
      dropdown.addEventListener('mouseleave', () => hoverQuery.matches && (dropdown.open = false));
    });

    const menuDrawer = wrapper.querySelector('[data-menu-drawer]');
    menuDrawer?.addEventListener('toggle', () => {
      setVars();
      lockScroll(menuDrawer.open);
    });

    const search = wrapper.querySelector('[data-search-toggle]');
    search?.addEventListener('toggle', () => {
      if (search.open) search.querySelector('input[type="search"]')?.focus();
    });

    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape') return;
        const open = [...wrapper.querySelectorAll('details[open]')];
        if (!open.length) return;
        open.forEach((details) => (details.open = false));
        open[0].querySelector('summary')?.focus();
      },
      { signal }
    );

    document.addEventListener(
      'click',
      (event) => {
        wrapper.querySelectorAll('[data-dropdown][open], [data-search-toggle][open]').forEach((details) => {
          if (!details.contains(event.target)) details.open = false;
        });
      },
      { signal }
    );
  }

  /* ---------- Announcement bar ---------- */

  class AnnouncementBar extends HTMLElement {
    connectedCallback() {
      this.messages = [...this.querySelectorAll('.announcement__message')];
      if (this.messages.length < 2) return;
      this.index = 0;
      this.paused = false;
      ['mouseenter', 'focusin'].forEach((type) => this.addEventListener(type, () => (this.paused = true)));
      ['mouseleave', 'focusout'].forEach((type) => this.addEventListener(type, () => (this.paused = false)));
      this.timer = setInterval(() => !this.paused && this.show(this.index + 1), Number(this.dataset.interval) || 5000);

      this.onBlockSelect = (event) => {
        const index = this.messages.indexOf(event.target);
        if (index > -1) {
          this.paused = true;
          this.show(index);
        }
      };
      this.onBlockDeselect = () => (this.paused = false);
      document.addEventListener('shopify:block:select', this.onBlockSelect);
      document.addEventListener('shopify:block:deselect', this.onBlockDeselect);
    }

    disconnectedCallback() {
      clearInterval(this.timer);
      document.removeEventListener('shopify:block:select', this.onBlockSelect);
      document.removeEventListener('shopify:block:deselect', this.onBlockDeselect);
    }

    show(index) {
      this.index = (index + this.messages.length) % this.messages.length;
      this.messages.forEach((message, i) => message.classList.toggle('is-active', i === this.index));
    }
  }
  define('announcement-bar', AnnouncementBar);

  /* ---------- Predictive search ---------- */

  class PredictiveSearch extends HTMLElement {
    connectedCallback() {
      if (this.dataset.enabled !== 'true') return;
      this.input = this.querySelector('input[type="search"]');
      this.results = this.querySelector('[data-predictive-results]');
      if (!this.input || !this.results) return;

      this.input.addEventListener('input', debounce(() => this.search(), 250));
      this.input.addEventListener('focus', () => {
        if (this.input.value.trim() && this.results.innerHTML.trim()) this.open();
      });
      this.addEventListener('keydown', (event) => this.onKeydown(event));
      this.onDocumentClick = (event) => !this.contains(event.target) && this.close();
      document.addEventListener('click', this.onDocumentClick);
    }

    disconnectedCallback() {
      document.removeEventListener('click', this.onDocumentClick);
    }

    async search() {
      const query = this.input.value.trim();
      if (!query) return this.close();

      this.controller?.abort();
      this.controller = new AbortController();
      const params = new URLSearchParams({
        q: query,
        'resources[type]': 'product,collection,article,page',
        'resources[limit]': '6',
        'resources[options][unavailable_products]': 'last',
        section_id: 'predictive-search',
      });

      try {
        const response = await fetch(`${routes.predictiveSearch}?${params}`, { signal: this.controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const inner = parseHTML(await response.text()).querySelector('.predictive-search__inner');
        this.results.innerHTML = inner ? inner.outerHTML : '';
        inner ? this.open() : this.close();
      } catch (error) {
        if (error.name !== 'AbortError') this.close();
      }
    }

    open() {
      this.results.hidden = false;
      this.input.setAttribute('aria-expanded', 'true');
    }

    close() {
      if (!this.results) return;
      this.results.hidden = true;
      this.input.setAttribute('aria-expanded', 'false');
    }

    onKeydown(event) {
      const links = [...this.results.querySelectorAll('a')];
      const index = links.indexOf(document.activeElement);
      if (event.key === 'Escape' && !this.results.hidden) {
        event.stopPropagation();
        this.close();
        this.input.focus();
      } else if (event.key === 'ArrowDown' && !this.results.hidden && links.length) {
        event.preventDefault();
        (links[index + 1] || links[0]).focus();
      } else if (event.key === 'ArrowUp' && !this.results.hidden && index > -1) {
        event.preventDefault();
        index === 0 ? this.input.focus() : links[index - 1].focus();
      }
    }
  }
  define('predictive-search', PredictiveSearch);

  /* ---------- Cart drawer ---------- */

  class CartDrawer extends HTMLElement {
    connectedCallback() {
      this.panel = this.querySelector('.drawer__panel');
      this.addEventListener('click', (event) => {
        if (event.target.closest('[data-drawer-close]')) this.close();
      });
      this.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') this.close();
        if (event.key === 'Tab') trapFocus(this.panel, event);
      });

      this.onToggleClick = (event) => {
        const toggle = event.target.closest('[data-cart-toggle]');
        if (!toggle || window.location.pathname === routes.cart) return;
        event.preventDefault();
        this.open(toggle);
      };
      document.addEventListener('click', this.onToggleClick);
    }

    disconnectedCallback() {
      document.removeEventListener('click', this.onToggleClick);
    }

    open(trigger) {
      this.trigger = trigger || document.activeElement;
      this.classList.add('is-open');
      document.documentElement.classList.add('drawer-open');
      lockScroll(true);
      requestAnimationFrame(() => this.panel.focus());
    }

    close() {
      if (!this.classList.contains('is-open')) return;
      this.classList.remove('is-open');
      document.documentElement.classList.remove('drawer-open');
      lockScroll(false);
      this.trigger?.focus?.();
    }
  }
  define('cart-drawer', CartDrawer);

  /* ---------- Quantity input ---------- */

  class QuantityInput extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input');
      this.addEventListener('click', (event) => {
        const button = event.target.closest('button[name]');
        if (!button || !this.input) return;
        const step = Number(this.input.step) || 1;
        const min = this.input.min !== '' ? Number(this.input.min) : 0;
        const max = this.input.max !== '' ? Number(this.input.max) : Infinity;
        const current = Number(this.input.value) || 0;
        const next = button.name === 'plus' ? Math.min(current + step, max) : Math.max(current - step, min);
        if (next === current) return;
        this.input.value = next;
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
  }
  define('quantity-input', QuantityInput);

  /* ---------- Cart lines (drawer + cart page) ---------- */

  class CartItems extends HTMLElement {
    connectedCallback() {
      const onQuantityChange = debounce((input) => this.update(input.dataset.line, input.value, input), 400);
      this.addEventListener('change', (event) => {
        if (event.target.matches('input[data-line]')) onQuantityChange(event.target);
      });
      this.addEventListener('click', (event) => {
        const remove = event.target.closest('[data-remove-line]');
        if (!remove) return;
        event.preventDefault();
        this.update(remove.dataset.removeLine, 0, remove);
      });
    }

    async update(line, quantity, source) {
      const region = this.closest('[data-render-section]')?.dataset.renderSection;
      const error = this.querySelector('[data-cart-error]');
      const refocusName = source?.matches('input') ? 'input' : null;
      this.classList.add('is-loading');
      if (error) error.hidden = true;

      try {
        await Cart.change(Number(line), Number(quantity));
        const scope = region ? document.querySelector(`[data-render-section="${region}"]`) : null;
        const target =
          (refocusName && scope?.querySelector(`.cart-line[data-line="${line}"] input[data-line]`)) ||
          scope?.querySelector('input[data-line], [data-drawer-close], .btn');
        target?.focus({ preventScroll: true });
      } catch (err) {
        this.classList.remove('is-loading');
        if (error) {
          error.textContent = err.message;
          error.hidden = false;
        }
      }
    }
  }
  define('cart-items', CartItems);

  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-cart-note]')) Cart.updateNote(event.target.value).catch(() => {});
  });

  /* ---------- Product form (add to cart) ---------- */

  class ProductForm extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      this.form?.addEventListener('submit', (event) => this.onSubmit(event));
    }

    async onSubmit(event) {
      const drawer = document.querySelector('cart-drawer');
      // Page-cart mode (or no drawer): let the browser post to /cart/add → /cart.
      if (theme.cartType !== 'drawer' || !drawer) return;
      event.preventDefault();

      const button = this.form.querySelector('[type="submit"][name="add"]');
      const error = this.form.querySelector('.form-error');
      if (!button || button.disabled) return;

      button.classList.add('is-loading');
      button.setAttribute('aria-busy', 'true');
      if (error) error.hidden = true;

      try {
        await Cart.add(new FormData(this.form));
        drawer.open(button);
      } catch (err) {
        if (error) {
          error.textContent = err.message;
          error.hidden = false;
        }
      } finally {
        button.classList.remove('is-loading');
        button.removeAttribute('aria-busy');
      }
    }
  }
  define('product-form', ProductForm);

  /* ---------- Variant picker + product info ---------- */

  class VariantPicker extends HTMLElement {
    connectedCallback() {
      this.addEventListener('change', (event) => {
        if (!event.target.matches('input[type="radio"]')) return;
        const selected = [...this.querySelectorAll('fieldset')].map((fieldset) => fieldset.querySelector('input:checked')?.value);
        const variants = JSON.parse(this.querySelector('[data-variants]')?.textContent || '[]');
        const variant = variants.find((v) => v.options.every((option, i) => option === selected[i]));
        this.dispatchEvent(
          new CustomEvent('variant:change', { bubbles: true, detail: { variant, focusId: event.target.id } })
        );
      });
    }
  }
  define('variant-picker', VariantPicker);

  class ProductInfo extends HTMLElement {
    connectedCallback() {
      this.addEventListener('variant:change', (event) => this.onVariantChange(event.detail));
    }

    async onVariantChange({ variant, focusId }) {
      const input = this.querySelector('[data-variant-input]');
      const addButton = this.querySelector('[data-swap-id^="add-"]');

      if (!variant) {
        if (addButton) {
          addButton.disabled = true;
          const label = addButton.querySelector('.btn__label');
          if (label) label.textContent = strings.unavailable;
        }
        return;
      }

      if (input) input.value = variant.id;
      const url = `${this.dataset.url}?variant=${variant.id}`;
      window.history.replaceState(window.history.state, '', url);

      this.controller?.abort();
      this.controller = new AbortController();

      try {
        const response = await fetch(`${url}&section_id=${this.dataset.sectionId}`, { signal: this.controller.signal });
        const doc = parseHTML(await response.text());

        doc.querySelectorAll('[data-swap-id]').forEach((fresh) => {
          const current = this.querySelector(`[data-swap-id="${fresh.dataset.swapId}"]`);
          if (current) current.replaceWith(document.importNode(fresh, true));
        });

        const mediaId = doc.querySelector('product-info')?.dataset.featuredMediaId;
        if (mediaId) this.querySelector('media-gallery')?.setActive(mediaId);
        if (focusId) document.getElementById(focusId)?.focus();
        window.Shopify?.PaymentButton?.init?.();
      } catch (error) {
        if (error.name !== 'AbortError') console.error(error);
      }
    }
  }
  define('product-info', ProductInfo);

  /* ---------- Media gallery ---------- */

  class MediaGallery extends HTMLElement {
    connectedCallback() {
      this.slides = this.querySelector('.gallery__slides');
      this.thumbs = [...this.querySelectorAll('.gallery__thumb')];
      this.thumbs.forEach((thumb) => thumb.addEventListener('click', () => this.setActive(thumb.dataset.mediaId)));

      if (this.slides && this.thumbs.length && 'IntersectionObserver' in window) {
        this.observer = new IntersectionObserver(
          (entries) => entries.forEach((entry) => entry.isIntersecting && this.markActive(entry.target.dataset.mediaId)),
          { root: this.slides, threshold: 0.6 }
        );
        this.slides.querySelectorAll('.gallery__slide').forEach((slide) => this.observer.observe(slide));
      }
    }

    disconnectedCallback() {
      this.observer?.disconnect();
    }

    setActive(mediaId) {
      const slide = this.slides?.querySelector(`.gallery__slide[data-media-id="${mediaId}"]`);
      if (!slide) return;
      this.slides.scrollTo({
        left: slide.offsetLeft - this.slides.offsetLeft,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
      this.markActive(mediaId);
    }

    markActive(mediaId) {
      this.querySelectorAll('.gallery__slide').forEach((slide) =>
        slide.classList.toggle('is-active', slide.dataset.mediaId === String(mediaId))
      );
      this.thumbs.forEach((thumb) => {
        const active = thumb.dataset.mediaId === String(mediaId);
        thumb.classList.toggle('is-active', active);
        active ? thumb.setAttribute('aria-current', 'true') : thumb.removeAttribute('aria-current');
      });
    }
  }
  define('media-gallery', MediaGallery);

  /* ---------- Share ---------- */

  class ShareButton extends HTMLElement {
    connectedCallback() {
      const button = this.querySelector('[data-copy-url]');
      button?.addEventListener('click', async () => {
        const url = button.dataset.copyUrl;
        if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
          navigator.share({ title: document.title, url }).catch(() => {});
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          const label = button.querySelector('[data-copy-label]');
          const original = label.textContent;
          label.textContent = strings.linkCopied;
          setTimeout(() => (label.textContent = original), 2000);
        } catch (error) {
          /* Clipboard blocked — nothing useful to do. */
        }
      });
    }
  }
  define('share-button', ShareButton);

  /* ---------- Product recommendations ---------- */

  class ProductRecommendations extends HTMLElement {
    connectedCallback() {
      if (!this.dataset.url || this.dataset.loaded) return;
      const load = async () => {
        this.dataset.loaded = 'true';
        try {
          const response = await fetch(this.dataset.url);
          const fresh = parseHTML(await response.text()).querySelector('product-recommendations');
          if (fresh && fresh.innerHTML.trim()) {
            this.innerHTML = fresh.innerHTML;
          } else {
            this.closest('.section')?.setAttribute('hidden', '');
          }
        } catch (error) {
          console.error(error);
        }
      };

      if (!('IntersectionObserver' in window)) return load();
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer.disconnect();
          load();
        },
        { rootMargin: '0px 0px 400px 0px' }
      );
      observer.observe(this);
    }
  }
  define('product-recommendations', ProductRecommendations);

  /* ---------- Collection / search filtering ---------- */

  class FacetFilters extends HTMLElement {
    connectedCallback() {
      this.sectionId = this.dataset.sectionId;
      const submit = debounce(() => this.submitForm(), 500);

      this.addEventListener('change', (event) => {
        if (event.target.closest('[data-facets-form]')) submit();
      });
      this.addEventListener('input', (event) => {
        if (event.target.type === 'number' && event.target.closest('[data-facets-form]')) submit();
      });
      this.addEventListener('submit', (event) => {
        if (!event.target.matches('[data-facets-form]')) return;
        event.preventDefault();
        this.submitForm();
      });
      this.addEventListener('click', (event) => {
        const link = event.target.closest('[data-facet-link]');
        if (link) {
          event.preventDefault();
          this.render(link.href);
          return;
        }
        const toggle = event.target.closest('.facets__toggle');
        if (toggle) {
          const aside = this.querySelector('.collection__filters');
          const open = !aside.classList.contains('is-open');
          aside.classList.toggle('is-open', open);
          toggle.setAttribute('aria-expanded', String(open));
        }
      });

      if (!window.history.state?.facets) {
        window.history.replaceState({ ...(window.history.state || {}), facets: true }, '', window.location.href);
      }
      this.onPopState = (event) => event.state?.facets && this.render(window.location.href, false);
      window.addEventListener('popstate', this.onPopState);
    }

    disconnectedCallback() {
      window.removeEventListener('popstate', this.onPopState);
    }

    submitForm() {
      const form = this.querySelector('[data-facets-form]');
      if (!form) return;
      const params = new URLSearchParams();
      new FormData(form).forEach((value, key) => value !== '' && params.append(key, value));
      this.render(`${window.location.pathname}?${params}`);
    }

    async render(url, push = true) {
      const results = this.querySelector('[data-facets-region="results"]');
      results?.classList.add('is-loading');

      const target = new URL(url, window.location.origin);
      target.searchParams.set('section_id', this.sectionId);

      this.controller?.abort();
      this.controller = new AbortController();

      try {
        const response = await fetch(target, { signal: this.controller.signal });
        const doc = parseHTML(await response.text());
        const activeId = document.activeElement?.id;
        const openState = [...this.querySelectorAll('details.facets__group')].map((d) => [d.id, d.open]);

        ['results', 'filters'].forEach((name) => {
          const current = this.querySelector(`[data-facets-region="${name}"]`);
          const fresh = doc.querySelector(`[data-facets-region="${name}"]`);
          if (current && fresh) current.innerHTML = fresh.innerHTML;
        });

        openState.forEach(([id, open]) => {
          const details = id && this.querySelector(`#${CSS.escape(id)}`);
          if (details) details.open = open;
        });

        const aside = this.querySelector('.collection__filters');
        this.querySelector('.facets__toggle')?.setAttribute('aria-expanded', String(!!aside?.classList.contains('is-open')));
        if (activeId) document.getElementById(activeId)?.focus({ preventScroll: true });

        if (push) {
          const clean = new URL(url, window.location.origin);
          clean.searchParams.delete('section_id');
          window.history.pushState({ facets: true }, '', clean);
        }
      } catch (error) {
        if (error.name !== 'AbortError') window.location.href = url;
      } finally {
        this.querySelector('[data-facets-region="results"]')?.classList.remove('is-loading');
      }
    }
  }
  define('facet-filters', FacetFilters);

  /* ---------- Plant finder quiz ---------- */

  class PlantFinder extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      if (!this.form) return;
      this.steps = [...this.querySelectorAll('.finder__step')];
      this.progress = [...this.querySelectorAll('.finder__progress li')];
      this.index = 0;

      this.addEventListener('click', (event) => {
        if (event.target.closest('[data-finder-next]')) this.go(1);
        if (event.target.closest('[data-finder-back]')) this.go(-1);
      });
      this.form.addEventListener('change', () => this.clearErrors());
      this.form.addEventListener('submit', (event) => this.onSubmit(event));

      this.onBlockSelect = (event) => {
        const index = this.steps.indexOf(event.target);
        if (index > -1) this.show(index);
      };
      document.addEventListener('shopify:block:select', this.onBlockSelect);
    }

    disconnectedCallback() {
      document.removeEventListener('shopify:block:select', this.onBlockSelect);
    }

    hasAnswer() {
      return !!this.steps[this.index]?.querySelector('input:checked');
    }

    go(direction) {
      if (direction > 0 && !this.hasAnswer()) return this.showError();
      this.show(this.index + direction, true);
    }

    show(index, focus = false) {
      this.index = Math.max(0, Math.min(index, this.steps.length - 1));
      this.steps.forEach((step, i) => step.classList.toggle('is-active', i === this.index));
      this.progress.forEach((bar, i) => {
        bar.classList.toggle('is-active', i === this.index);
        bar.classList.toggle('is-done', i < this.index);
      });
      if (focus) {
        const step = this.steps[this.index];
        (step.querySelector('input:checked') || step.querySelector('input'))?.focus();
      }
    }

    showError() {
      const error = this.steps[this.index]?.querySelector('.finder__error');
      if (!error) return;
      error.textContent = strings.finderIncomplete;
      error.hidden = false;
    }

    clearErrors() {
      this.querySelectorAll('.finder__error').forEach((error) => (error.hidden = true));
    }

    onSubmit(event) {
      event.preventDefault();
      if (!this.hasAnswer()) return this.showError();
      // "lowland|tropical" → repeated params; "1..2" → .gte/.lte range params; blank ("any") → dropped.
      const params = new URLSearchParams();
      this.form.querySelectorAll('input:checked').forEach((input) => {
        input.value
          .split('|')
          .map((value) => value.trim())
          .filter(Boolean)
          .forEach((value) => {
            const range = value.match(/^(-?[\d.]+)?\.\.(-?[\d.]+)?$/);
            if (!range) return params.append(input.name, value);
            if (range[1] !== undefined) params.set(`${input.name}.gte`, range[1]);
            if (range[2] !== undefined) params.set(`${input.name}.lte`, range[2]);
          });
      });
      const query = params.toString();
      window.location.href = this.form.action + (query ? `?${query}` : '');
    }
  }
  define('plant-finder', PlantFinder);

  /* ---------- Live-plant dispatch countdown (SAST) ---------- */

  class DispatchNotice extends HTMLElement {
    connectedCallback() {
      this.eta = this.querySelector('[data-dispatch-eta]');
      const dispatch = theme.dispatch;
      if (!this.eta || !dispatch || dispatch.paused || !dispatch.days?.length) return;
      this.update();
      this.timer = setInterval(() => this.update(), 60000);
    }

    disconnectedCallback() {
      clearInterval(this.timer);
    }

    now() {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Johannesburg',
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
      }).formatToParts(new Date());
      const get = (type) => parts.find((part) => part.type === type)?.value;
      const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
      return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
    }

    update() {
      const { days, cutoffHour } = theme.dispatch;
      const { day, minutes } = this.now();
      if (day < 0) return;
      const cutoff = cutoffHour * 60;

      if (days.includes(day) && minutes < cutoff) {
        const left = cutoff - minutes;
        const hours = Math.floor(left / 60);
        const mins = left % 60;
        this.eta.textContent = strings.dispatchToday.replace('[time]', hours > 0 ? `${hours}h ${mins}m` : `${mins}m`);
        return;
      }

      const names = String(strings.weekdays || '').split(',');
      for (let offset = 1; offset <= 7; offset += 1) {
        const next = (day + offset) % 7;
        if (days.includes(next)) {
          this.eta.textContent = strings.dispatchNext.replace('[day]', names[next] || '');
          return;
        }
      }
    }
  }
  define('dispatch-notice', DispatchNotice);

  /* ---------- Customer addresses: country → province ---------- */

  class AddressForm extends HTMLElement {
    connectedCallback() {
      this.country = this.querySelector('[data-country-select]');
      this.province = this.querySelector('[data-province-select]');
      if (!this.country || !this.province) return;
      const preset = this.country.dataset.default;
      if (preset && [...this.country.options].some((option) => option.value === preset)) this.country.value = preset;
      this.populate(this.province.dataset.default);
      this.country.addEventListener('change', () => this.populate());
    }

    populate(selected) {
      let provinces = [];
      try {
        provinces = JSON.parse(this.country.selectedOptions[0]?.dataset.provinces || '[]');
      } catch (error) {
        provinces = [];
      }
      this.province.innerHTML = '';
      provinces.forEach(([value, label]) => this.province.add(new Option(label, value)));
      if (selected) this.province.value = selected;
      const field = this.province.closest('[data-province-field]');
      if (field) field.hidden = provinces.length === 0;
    }
  }
  define('address-form', AddressForm);

  /* ---------- Login ↔ password recovery ---------- */

  function initAuthToggles() {
    const login = document.getElementById('Login');
    const recover = document.getElementById('Recover');
    if (!login || !recover) return;

    const show = (id, focus) => {
      login.classList.toggle('is-hidden', id !== 'Login');
      recover.classList.toggle('is-active', id === 'Recover');
      if (focus) document.getElementById(id)?.querySelector('input')?.focus();
    };

    document.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-auth-toggle]');
      if (!toggle) return;
      event.preventDefault();
      show(toggle.dataset.authToggle, true);
    });

    if (window.location.hash === '#Recover' || recover.querySelector('.form-message')) show('Recover', false);
  }

  /* ---------- Boot ---------- */

  initHeader();
  initAuthToggles();

  document.addEventListener('shopify:section:load', (event) => {
    if (event.target.querySelector('.header-wrapper')) initHeader();
  });
})();
