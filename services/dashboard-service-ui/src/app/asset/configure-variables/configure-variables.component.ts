import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AssetService } from 'src/app/services/asset-service.service';

@Component({
  selector: 'app-configure-variables',
  standalone: false,
  templateUrl: './configure-variables.component.html',
  styleUrl: './configure-variables.component.scss'
})
export class ConfigureVariablesComponent implements OnInit {

  @Input() displayDialog: boolean = false;
  @Input() assetId: string = '';
  @Output() displayDialogChange = new EventEmitter<boolean>();

  assetVariables: any[] = [];

  constructor(private readonly assetService: AssetService) {
  }

  ngOnInit(): void {
    this.assetService.getVaraiblesbyAssetId(this.assetId).subscribe((variablesResponse) => {
      this.assetVariables = [...variablesResponse];
    });
  }

  onSubmit(): void {
    this.onCloseDialog();
  }

  onCloseDialog(): void {
    this.displayDialogChange.emit(false);
  }

  removeAssetVariable(variableDefinitionId: string): void {
    this.assetService.removeAssetVariables(this.assetId, variableDefinitionId).subscribe(() => {
      this.assetVariables = this.assetVariables.filter(
        (assetVariable) => assetVariable.variableDefinition.id !== variableDefinitionId
      );
    });
  }

}
