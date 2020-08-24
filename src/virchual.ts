import './css/styles.css';
import { Drag } from './drag';
import { Pagination } from './pagination';
import { Slide } from './slide';
import { Sign, identity } from './types';
import { assert } from './utils/error';
import { Event, stop } from './utils/event';
import { slidingWindow } from './utils/sliding-window';
import { range, rewind } from './utils/utils';

export type VirchualOptions = {
  slides?: string[] | (() => string[]);
  speed?: number;
  easing?: string;
  swipeDistanceThreshold?: number;
  flickVelocityThreshold?: number;
  flickPower?: number;
  pagination?: boolean;
  window?: number;
};

export class Virchual {
  container: HTMLElement;
  frame: HTMLElement;
  paginationButtons: HTMLButtonElement[];
  currentIndex = 0;

  private slides: Slide[] = [];
  private event: Event;
  private isBusy = false;
  private pagination: Pagination;

  private eventBindings: {
    onClick: () => identity;
    onDrag: () => identity;
    onDragEnd: () => identity;
    onPaginationButtonClick: () => identity;
  };

  constructor(public selector: HTMLElement | string, public options: VirchualOptions = {}) {
    this.container = selector instanceof Element ? selector : document.querySelector(selector);
    this.frame = this.container.querySelector('.virchual__frame');
    this.paginationButtons = [].slice.call(this.container.querySelectorAll('.virchual__control'));

    assert(this.frame, 'Invalid element/selector');

    this.currentIndex = 0;
    this.options = {
      slides: [],
      speed: 200,
      swipeDistanceThreshold: 150,
      flickVelocityThreshold: 0.6,
      flickPower: 600,
      easing: 'ease-out',
      pagination: true,
      window: 1,
      ...options,
    };

    this.event = new Event();

    this.eventBindings = {
      onClick: this.onClick.bind(this),
      onDrag: this.onDrag.bind(this),
      onDragEnd: this.onDragEnd.bind(this),
      onPaginationButtonClick: this.onPaginationButtonClick.bind(this),
    };

    let rawSlides;

    if (typeof this.options.slides === 'function') {
      rawSlides = this.options.slides();
    } else {
      rawSlides = this.options.slides;
    }

    this.slides = this.hydrate();

    this.slides = this.slides.concat((rawSlides || []).map(slide => new Slide(slide, this.frame, this.options)));

    this.bindEvents();

    new Drag(this.frame, { event: this.event }).start();
    this.pagination = new Pagination(this.container, this.slides.length);

    this.pagination.render();
  }

  /**
   * Mount components.
   */
  mount() {
    this.event.emit('mounted');

    this.mountAndUnmountSlides();
  }

  /**
   * Register callback fired on the given event(s).
   *
   * @param events  - An event name. Use space to separate multiple events.
   *                             Also, namespace is accepted by dot, such as 'resize.{namespace}'.
   * @param handler - A callback function.
   * @param elm     - Optional. Native event will be listened to when this arg is provided.
   * @param options - Optional. Options for addEventListener.
   */
  on(events: string, handler: identity, elm: (Window & typeof globalThis) | Element = null, options: Record<string, unknown> = {}) {
    this.event.on(events, handler, elm, options);
  }

  /**
   * Unsubscribe the given event.
   *
   * @param events - A event name.
   * @param elm    - Optional. removeEventListener() will be called when this arg is provided.
   */
  off(events: string, elm: (Window & typeof globalThis) | Element = null) {
    this.event.off(events, elm);
  }

  /**
   * Go to previous slide.
   */
  prev() {
    console.debug('[Controls] Previous');

    this.go('prev');
  }

  /**
   * Go to next slide.
   */
  next() {
    console.debug('[Controls] Next');

    this.go('next');
  }

  private go(direction: 'prev' | 'next') {
    const slide = this.slides[this.currentIndex];

    slide.translate(-100, () => {
      this.isBusy = false;
    });

    const sign: Sign = direction === 'prev' ? -1 : +1;

    this.currentIndex = rewind(this.currentIndex + sign * 1, this.slides.length - 1);

    this.mountAndUnmountSlides({ direction });

    const move = direction === 'prev' ? this.pagination.prev.bind(this.pagination) : this.pagination.next.bind(this.pagination);

    move();
  }

  private hydrate(): Slide[] {
    const slideElements = [].slice.call(this.frame.querySelectorAll('div')) as HTMLDivElement[];

    return slideElements.map(element => new Slide(element, this.frame, this.options));
  }

  /**
   * Mount and unmount slides.
   */
  private mountAndUnmountSlides({ direction }: { direction?: 'prev' | 'next' } = {}) {
    const currentSlide = this.slides[this.currentIndex];
    const indices = range(0, this.slides.length - 1);

    const mountableSlideIndices = slidingWindow(indices, this.currentIndex, this.options.window);
    const mountableSlideIndicesWithOffset = slidingWindow(indices, this.currentIndex, this.options.window + 1);

    mountableSlideIndicesWithOffset.forEach(index => {
      const slide = this.slides[index];

      if (index === this.currentIndex) {
        currentSlide.set('isActive', true);
      } else {
        currentSlide.set('isActive', false);
      }

      const realIndex = mountableSlideIndices.indexOf(index);

      // unmount
      if (realIndex < 0) {
        return slide.unmount();
      }

      slide.set('position', (this.options.window - realIndex) * -100);

      const prepend = direction === 'prev' || (direction == null && this.slides[0].isMounted && realIndex - this.options.window < 0);

      slide.mount(prepend);
    });
  }

  private bindEvents() {
    this.event.on('drag', this.eventBindings.onDrag);
    this.event.on('dragend', this.eventBindings.onDragEnd);
    this.event.on('click', this.eventBindings.onClick, this.frame, { capture: true });

    this.paginationButtons.forEach(button => this.event.on('click', this.eventBindings.onPaginationButtonClick, button));
  }

  /**
   * Called when frame is clicked.
   *
   * @param event A click event.
   */
  private onClick(event: MouseEvent) {
    this.isBusy && stop(event);
  }

  private onPaginationButtonClick(event: MouseEvent) {
    const button: HTMLButtonElement = (event.target as Element).closest('button') as HTMLButtonElement;
    const direction = button.dataset.controls as 'prev' | 'next';

    const move = direction === 'prev' ? this.prev.bind(this) : this.next.bind(this);

    move();
  }

  /**
   * Handle drag event.
   *
   * @param event
   */
  private onDrag(event: { offset: { x: number; y: number }; direction: 'prev' | 'next' }) {
    this.isBusy = true;

    const mountableSlideIndices = slidingWindow(range(0, this.slides.length - 1), this.currentIndex, this.options.window);

    const sign = event.direction === 'prev' ? +1 : -1;

    mountableSlideIndices.forEach(index => {
      const slide = this.slides[index];

      const x = sign * Math.abs(event.offset.x);

      slide.translate(x);
    });
  }

  /**
   * Handle dragged event.
   *
   * @param event
   */
  private onDragEnd(event: { direction: 'prev' | 'next' }) {
    console.debug('[Drag] Drag end', event);

    this.go(event.direction);
  }
}

[].forEach.call(document.querySelectorAll('.image-swiper'), (slider: HTMLElement) => {
  const instance = new Virchual(slider, {
    slides: () => {
      const slides: string[] = [];

      for (let i = 0; i < 10; i++) {
        slides.push(`
          <picture>
            <source
              type="image/webp"
              srcset="
                https://i.findheim.at/images/sm/6iBu4sycxr9kXMlcbyVyz.webp,
                https://i.findheim.at/images/md/6iBu4sycxr9kXMlcbyVyz.webp 2x
              " />
            <source
              type="image/jpeg"
              srcset="
                https://i.findheim.at/images/sm/6iBu4sycxr9kXMlcbyVyz.jpg,
                https://i.findheim.at/images/md/6iBu4sycxr9kXMlcbyVyz.jpg 2x
              " />
            <img src="https://i.findheim.at/images/md/6iBu4sycxr9kXMlcbyVyz.jpg" itemprop="image"/>
          </picture>
        `);
      }

      return slides;
    },
  });

  instance.mount();
});
