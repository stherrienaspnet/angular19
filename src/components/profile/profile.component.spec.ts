import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GlobalServiceService } from '../../services';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  it('sets the header title and displays the user', () => {
    const headerTitle = signal('');
    const user = signal({ name: 'Jane Doe', picture: 'jane.webp' });
    TestBed.configureTestingModule({
      providers: [{ provide: GlobalServiceService, useValue: { headerTitle, user } }],
    }).overrideComponent(ProfileComponent, {
      set: {
        imports: [],
        template: '<strong>{{ globalService.user().name }}</strong>',
      },
    });
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    expect(headerTitle()).toBe('Profile');
    expect((fixture.nativeElement as HTMLElement).textContent).toBe('Jane Doe');
  });
});
