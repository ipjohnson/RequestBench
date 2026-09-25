import { Controller, Get, Inject, Render } from '@nestjs/common';

import { PAYLOADS, type Payload, type Payloads } from '../payloads.js';

/**
 * template: the payload rendered by Handlebars through @Render(), with the view engine the host sets
 * up for its platform, as Nest's MVC guide does: hbs on Express, and @fastify/view on Fastify. The
 * name carries the extension, which Fastify needs and Express accepts. Express's res.render writes the
 * response's locals into the object it is handed, so each render gets a copy.
 */
@Controller('template')
export class TemplateController {
  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads) {}

  // rb:handler template.small
  @Get('small')
  @Render('items.hbs')
  small(): Payload {
    return { ...this.payloads.small };
  }

  // rb:handler template.medium
  @Get('medium')
  @Render('items.hbs')
  medium(): Payload {
    return { ...this.payloads.medium };
  }
}
