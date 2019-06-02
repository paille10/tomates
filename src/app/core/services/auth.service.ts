import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { switchMap, tap, catchError, finalize, delay } from 'rxjs/operators';
import { User } from 'src/app/shared/models/user';
import { HttpHeaders } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { UsersService } from 'src/app/core/services/users.service';
import { ErrorService } from 'src/app/core/services/error.service';
import { LoaderService } from 'src/app/core/services/loader.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private user: BehaviorSubject<User|null> = new BehaviorSubject(null);
  public readonly user$: Observable<User|null> = this.user.asObservable();

  constructor(
    private http: HttpClient,
    private usersService: UsersService,
    private errorService: ErrorService,
    private loaderService: LoaderService,
    private router: Router) { }

  public register(name: string, email: string, password: string): Observable<User|null> {
    const url = `${environment.firebase.auth.baseURL}/signupNewUser?key=${environment.firebase.apiKey}`;

    const data = {
      email: email,
      password: password,
      returnSecureToken: true
    };

    const httpOptions = {
      headers: new HttpHeaders({'Content-Type':  'application/json'})
    };

    this.loaderService.setLoading(true);

    return this.http.post(url, data, httpOptions).pipe(
      switchMap((data: any) => {
        const jwt: string = data.idToken;
        const user = new User({
          email: data.email,
          id: data.localId,
          name: name
        });
        this.saveAuthData(jwt, user.id);
        return this.usersService.save(user, jwt);
      }),
      tap(user => this.user.next(user)),
      tap(_ => this.logoutTimer(3600)),
      catchError(error => this.errorService.handleError(error)),
      finalize(() => this.loaderService.setLoading(false))
    );
  }

  public login(email: string, password: string): Observable<User|null> {
    const url = `${environment.firebase.auth.baseURL}/verifyPassword?key=${environment.firebase.apiKey}`;
    const data = {
      email: email,
      password: password,
      returnSecureToken: true
    };
    const httpOptions = {
      headers: new HttpHeaders({'Content-Type':  'application/json'})
    };

    this.loaderService.setLoading(true);

    return this.http.post<User>(url, data, httpOptions).pipe(
      switchMap((data: any) => {
        const userId: string = data.localId;
        const jwt: string = data.idToken;
        this.saveAuthData(jwt, userId);
        return this.usersService.get(userId, jwt);
      }),
      tap(user => this.user.next(user)),
      tap(_ => this.logoutTimer(3600)),
      catchError(error => this.errorService.handleError(error)),
      finalize(() => this.loaderService.setLoading(false))
    );
  }

  public logout(): void {
    localStorage.removeItem('expirationDate');
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    this.user.next(null);
    this.router.navigate(['/login']);
  }

  private logoutTimer(expirationTime: number): void {
    of(true).pipe(
      delay(expirationTime*1000)
    ).subscribe(_ => this.logout());
  }

  private saveAuthData(token: string, userId: string) {
    const now = new Date();
    const expirationDate = (now.getTime() + 3600*1000).toString();
    localStorage.setItem('expirationDate', expirationDate);
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
  }

  public autoLogin(user: User) {
    this.user.next(user);
    this.router.navigate(['app/dashboard']);
  }

}
