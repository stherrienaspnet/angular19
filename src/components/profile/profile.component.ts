import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { TuiAvatar } from '@taiga-ui/kit';
import { GlobalServiceService } from '../../services';

@Component({
  selector: 'app-profile',
  imports: [TuiAvatar, TranslatePipe],
  templateUrl: './profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex grow',
  },
})
export class ProfileComponent {
  protected readonly globalService = inject(GlobalServiceService);

  constructor() {
    // Set the header title when this component is loaded
    this.globalService.headerTitle.set('Profile');
  }
}
